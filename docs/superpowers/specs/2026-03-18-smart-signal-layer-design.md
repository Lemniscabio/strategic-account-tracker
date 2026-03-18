# Smart Signal Layer — Design Spec

**Date:** 2026-03-18
**Status:** Draft

## Overview

Add an intelligent layer on top of the existing signal enrichment pipeline. Three systems working together: auto-relevance scoring, per-account keyword filtering, and an account-scoped AI assistant — all powered by Gemini 2.5 Flash via Google AI Studio.

## Goals

1. Reduce signal noise — auto-score and dismiss irrelevant signals
2. Improve signal relevance — per-account keywords sharpen enrichment queries
3. Surface actionable intelligence — AI assistant explains signals, suggests actions, and recommends keywords
4. Keep it simple — founder-only tool, no multi-user complexity

## Non-Goals

- Multi-user / team features
- CRM integrations
- LinkedIn signal source (future)
- Conversation history persistence (chat is ephemeral per session)

---

## 1. Auto-Relevance Scoring

### Trigger
Scoring runs automatically **after enrichment completes** — chained at the end of the enrich flow. This is the natural point when new unscored signals appear. Scoring does NOT run on page load to avoid wasted API calls and UI flicker.

Additionally, a **"Re-score all"** button is available on the account detail page for manual re-scoring (useful after keywords change).

### Flow
1. User clicks "Refresh Signals" (or keywords are added, triggering auto-refresh)
2. Enrichment runs (Serper + RSS) → new signals inserted as `Suggested` with `relevanceScore: null`
3. Enrichment endpoint chains scoring: calls `scoreSignals()` for all unscored `Suggested` signals
4. Backend sends a single batch prompt to Gemini 2.5 Flash with:
   - Account context (name, type, stage, opportunity hypothesis, keywords — keywords may be empty, scoring still works)
   - List of signal titles + sources (max 20 per batch — if more, paginate into multiple calls)
   - Instruction to score each signal 1-5 for relevance to a biomanufacturing investor
5. Gemini returns structured JSON: `[{ signalId, score, reason }]`
6. Backend validates: clamps scores to 1-5 range, ignores unknown signalIds
7. Backend updates each signal with `relevanceScore` and `scoreReason`
8. Signals with score < 2 are auto-set to status `Dismissed`
9. Enrichment endpoint returns `{ newSignals, scored, dismissed }`
10. Frontend re-fetches signals — sorted server-side by `relevanceScore` desc (nulls last), then `date` desc

### Scoring Prompt Context
```
You are a signal relevance scorer for a biomanufacturing/CDMO-focused investment firm.

Account: {name} ({type}, stage: {stage})
Opportunity Hypothesis: {opportunityHypothesis}
Keywords: {keywords}

Score each signal 1-5:
5 = Directly actionable for investment/partnership decision
4 = Highly relevant to account strategy
3 = Moderately relevant, worth reviewing
2 = Tangentially related
1 = Irrelevant noise

Return JSON array: [{ "signalId": "...", "score": N, "reason": "one line" }]
```

### Signal Model Changes
```
+ relevanceScore: Number    // 1-5, optional, null = unscored
+ scoreReason: String       // one-line AI explanation, optional
```

### Edge Cases
- **Zero unscored signals:** Score endpoint returns `{ scored: 0, dismissed: 0 }` immediately without calling Gemini
- **Gemini returns unknown signalId:** Silently ignored (LLM hallucination)
- **Score outside 1-5:** Clamped to nearest valid value
- **Gemini returns malformed JSON:** Retry once, then fall back to unscored
- **Batch size:** Max 20 signals per Gemini call. If more, paginate into sequential calls.

### UI Changes
- Score badge (1-5) displayed on each signal card in the timeline
- Score reason shown on hover tooltip
- Signals sorted server-side: `{ relevanceScore: -1, date: -1 }` with unscored (null) signals sorted last
- "Re-score all" button on account detail page (clears existing scores and re-runs scoring)
- Scoring state: "Refresh Signals" button shows "Refreshing & Scoring..." while enrichment + scoring runs
- Auto-dismissed signals disappear from feed (existing behavior — dismissed signals are already filtered out)

---

## 2. Per-Account Keyword Filtering

### Account Model Changes
```
+ keywords: [String]    // default: [] (empty array)
```

### Behavior
- **Empty keywords (default):** Enrichment search query unchanged — `"[company]" news OR announcement OR funding OR hiring`
- **Keywords present:** Query becomes — `"[company]" [kw1] OR [kw2] OR [kw3] news OR announcement`
- Keywords are also passed to the scoring prompt for better relevance assessment

### How Keywords Get Added
1. **Manual:** User adds/removes keywords via a keyword chips UI on the account detail page
2. **AI-suggested:** Chatbot suggests keywords → user clicks "Accept" → keywords saved to account → auto-triggers signal refresh

### UI
- Keyword chips section on account detail page (above signal timeline)
- Each chip has an × to remove
- Text input to add new keywords manually
- When AI suggests keywords in chat, render them as clickable chips with "Add" action

### Enrichment Changes
- `enrichAccount()` accepts optional `keywords: string[]` parameter
- If keywords are provided, they modify the Serper search query and RSS query
- Serper: `"[company]" [keywords joined with OR] news OR announcement` (base terms always appended)
- RSS: `[company] [keywords joined with spaces]`

---

## 3. AI Assistant (Account-Scoped Chat)

### UI
- **Trigger:** Small icon button (sparkle/brain icon) on account detail page, positioned in the header area near existing action buttons
- **Click:** Opens a slide-out chat panel from the right side (~400px wide)
- **Close:** × button or click outside
- **Chat is ephemeral** — no conversation persistence across page loads

### Chat Panel Contents
- Chat message history (current session only)
- Text input at bottom with send button
- Suggested quick-action buttons at the top:
  - "Brief me on this account"
  - "Suggest keywords"
  - "What should I do next?"

### Backend: `POST /api/accounts/[id]/chat`

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "Why does this signal matter?" }
  ]
}
```

**Response:** Server-Sent Events (SSE) stream via `ReadableStream` with `TextEncoder`.
- Content-Type: `text/event-stream`
- Each chunk: `data: <text>\n\n`
- On error mid-stream: `data: [ERROR] <message>\n\n`
- On completion: `data: [DONE]\n\n`
- Frontend consumes via `fetch()` + `ReadableStream` reader

**Limits:**
- Max 10 most recent messages sent in request (older messages truncated)
- System prompt includes top 15 signals by score (not all signals, to stay within context limits)

### System Prompt
```
You are an AI assistant for a strategic account tracker used by a
biomanufacturing/CDMO-focused investment firm (Lemniscate).

You are viewing account: {name}
Type: {type} | Stage: {stage}
Opportunity Hypothesis: {opportunityHypothesis}
Founder Notes: {founderNote}
Keywords: {keywords}
Last Touchpoint: {lastTouchpoint}
Next Action: {nextAction} (due: {nextActionDate})

Current signals (sorted by relevance):
{signals formatted as: [score] title — source — date — reason}

You can:
1. Explain why any signal is relevant to Lemniscate's thesis
2. Suggest keywords to track — format as JSON: {"suggestedKeywords": ["kw1", "kw2"]}
3. Give a 30-second briefing on the account
4. Recommend concrete next actions based on signals and stage
5. Answer freeform questions about the account

Be concise. Speak like a smart analyst briefing a founder.
When suggesting keywords, always include the JSON format so the UI can parse and render them as actionable chips.
```

### Keyword Suggestion Flow
1. User asks "suggest keywords" or AI proactively suggests them
2. AI response includes `{"suggestedKeywords": ["cell therapy", "GMP facility", ...]}` in its text
3. Frontend parses keyword suggestions using regex: scan for `{"suggestedKeywords":` pattern, handle markdown code fences (```json ... ```), fail silently if not found (just show plain text)
4. Renders keywords as clickable chips with "Add" buttons
5. On click → `PUT /api/accounts/[id]` to add keyword → triggers `POST /api/accounts/[id]/enrich` (which now chains scoring) → refreshes signal feed

**Parsing strategy:** After stream completes, scan the full response text with:
```regex
\{"suggestedKeywords"\s*:\s*\[.*?\]\}
```
Strip any surrounding markdown fences first. If parsing fails, show response as plain text — no error to user.

---

## 4. Gemini Integration

### Client: `src/lib/ai/gemini.ts`

```typescript
// Thin wrapper around Google AI Studio API
// Uses @google/generative-ai SDK
// Env var: GEMINI_API_KEY

export async function generateJSON(prompt: string, systemPrompt?: string): Promise<unknown>
export async function generateStream(prompt: string, systemPrompt?: string): AsyncGenerator<string>
```

### Scoring: `src/lib/ai/scoring.ts`

```typescript
export async function scoreSignals(
  account: Account,
  signals: Signal[]
): Promise<{ signalId: string; score: number; reason: string }[]>
```

- Batches all unscored signals into a single Gemini call
- Parses structured JSON response
- Returns scores array

### Model
- Model string: `gemini-2.5-flash-preview-05-20` (or latest stable at implementation time)
- Can be upgraded to `gemini-2.5-pro` for chat if needed later

### Dependencies
- `@google/generative-ai` npm package
- `GEMINI_API_KEY` environment variable (add to `.env.local` and `.env.example`)

---

## 5. New API Endpoints

### `POST /api/accounts/[id]/score`
- Fetches unscored `Suggested` signals
- If zero unscored signals, returns `{ scored: 0, dismissed: 0 }` immediately (no Gemini call)
- Calls `scoreSignals()` with batch limit of 20
- Validates and clamps scores to 1-5, ignores unknown signalIds
- Updates signals in DB with scores
- Auto-dismisses score < 2
- Returns `{ scored: number, dismissed: number }`

### `POST /api/accounts/[id]/chat`
- Accepts `{ messages }` array (max 10 most recent, older truncated)
- Builds system prompt with full account context + top 15 signals by score
- Streams Gemini response as SSE (`text/event-stream`)
- Returns `ReadableStream` for frontend consumption

### Modified: `POST /api/accounts/[id]/enrich`
- Now passes `account.keywords` to `enrichAccount()`
- After enrichment, chains `scoreSignals()` for new unscored signals
- Returns `{ newSignals, scored, dismissed }`

---

## 6. File Structure (New & Modified)

### New Files
```
src/lib/ai/gemini.ts          — Gemini API client
src/lib/ai/scoring.ts         — Signal scoring logic
src/app/api/accounts/[id]/score/route.ts  — Scoring endpoint
src/app/api/accounts/[id]/chat/route.ts   — Chat endpoint
src/components/AiChat.tsx      — Chat panel component
src/components/AiChatButton.tsx — Trigger icon button
src/components/KeywordChips.tsx — Keyword display/edit component
```

### Modified Files
```
src/lib/models/signal.ts       — Add relevanceScore, scoreReason fields
src/lib/models/account.ts      — Add keywords field
src/lib/enrichment/enrich.ts   — Accept keywords, modify search queries
src/lib/enrichment/serper.ts   — Accept keywords parameter
src/lib/enrichment/rss.ts      — Accept keywords parameter
src/app/accounts/[id]/page.tsx — Add scoring on load, chat button, keyword chips, sorted feed
src/components/SignalTimeline.tsx — Show score badge, hover tooltip, update Signal interface
src/app/api/accounts/[id]/signals/route.ts — Sort by relevanceScore desc (nulls last), then date desc
```

---

## 7. Cost Estimate

Per account refresh + scoring cycle (assuming ~10 signals):
- Scoring prompt: ~500 tokens input, ~200 tokens output = ~$0.00005
- Chat message: ~1000 tokens input, ~300 tokens output = ~$0.0001

At 20 accounts refreshed daily with 2-3 chat messages each: **< $0.01/day**

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Gemini returns malformed JSON for scoring | Wrap in try/catch, fall back to unscored. Retry once. |
| Scoring takes too long (blocks page load) | Run scoring async — show feed immediately, update scores when ready |
| Keywords make search too narrow | Keep base terms (news, announcement) always appended |
| API key exposed in client | All Gemini calls server-side only via API routes |
| Stale scores after keyword change | "Re-score all" button available; keyword addition auto-triggers enrich + score |
| Large signal batch exceeds context | Batch limit of 20 signals per Gemini call, paginate if more |
| Chat context too large | Limit to top 15 signals + last 10 messages in system prompt |
