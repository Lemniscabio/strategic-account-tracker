# Smart Signal Layer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auto-relevance scoring, per-account keyword filtering, and an AI chat assistant to the strategic account tracker — powered by Gemini 2.5 Flash.

**Architecture:** Three systems layered onto existing enrichment pipeline. Scoring chains after enrichment. Keywords modify search queries. AI chat is a separate streaming endpoint. All Gemini calls go through a shared client wrapper.

**Tech Stack:** Next.js 14 (App Router), MongoDB/Mongoose, Google Generative AI SDK (`@google/generative-ai`), Gemini 2.5 Flash, SSE streaming, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-03-18-smart-signal-layer-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/ai/gemini.ts` | Gemini API client wrapper (JSON + streaming) |
| `src/lib/ai/scoring.ts` | Batch signal scoring logic |
| `src/app/api/accounts/[id]/score/route.ts` | Score endpoint |
| `src/app/api/accounts/[id]/chat/route.ts` | Chat streaming endpoint (SSE) |
| `src/components/KeywordChips.tsx` | Keyword display/add/remove chips |
| `src/components/AiChat.tsx` | Chat panel (slide-out + messages + input) |
| `src/components/AiChatButton.tsx` | Sparkle icon button to open chat |

### Modified Files
| File | Changes |
|------|---------|
| `src/lib/models/signal.ts` | Add `relevanceScore`, `scoreReason` fields |
| `src/lib/models/account.ts` | Add `keywords` field |
| `src/lib/enrichment/enrich.ts` | Accept `keywords` param, modify queries |
| `src/lib/enrichment/serper.ts` | Accept `keywords` param, modify search query |
| `src/lib/enrichment/rss.ts` | Accept `keywords` param, modify RSS query |
| `src/app/api/accounts/[id]/enrich/route.ts` | Pass keywords, chain scoring after enrichment |
| `src/app/api/accounts/[id]/signals/route.ts` | Sort by relevanceScore desc (nulls last), then date desc |
| `src/components/SignalTimeline.tsx` | Add score badge, hover tooltip for reason |
| `src/app/accounts/[id]/page.tsx` | Add keyword chips, chat button, re-score button, updated toast messages |
| `package.json` | Add `@google/generative-ai` dependency |

---

## Task 1: Install Gemini SDK & Create Client Wrapper

**Files:**
- Modify: `package.json`
- Create: `src/lib/ai/gemini.ts`

- [ ] **Step 1: Install the Google Generative AI SDK**

```bash
cd /Users/visheshpaliwal/repo/lem-all/strategic-account-tracker
npm install @google/generative-ai
```

- [ ] **Step 2: Create Gemini client wrapper**

Create `src/lib/ai/gemini.ts`:

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-2.5-flash-preview-05-20";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is required");
  return new GoogleGenerativeAI(apiKey);
}

export async function generateJSON<T = unknown>(
  prompt: string,
  systemPrompt?: string
): Promise<T> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: { responseMimeType: "application/json" },
  });

  const contents = [];
  if (systemPrompt) {
    contents.push({ role: "user" as const, parts: [{ text: systemPrompt }] });
    contents.push({ role: "model" as const, parts: [{ text: "Understood." }] });
  }
  contents.push({ role: "user" as const, parts: [{ text: prompt }] });

  const result = await model.generateContent({ contents });
  const text = result.response.text();
  return JSON.parse(text) as T;
}

export async function generateStream(
  messages: { role: "user" | "model"; content: string }[],
  systemPrompt?: string
): Promise<AsyncGenerator<string>> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: MODEL });

  const contents = [];
  if (systemPrompt) {
    contents.push({ role: "user" as const, parts: [{ text: systemPrompt }] });
    contents.push({ role: "model" as const, parts: [{ text: "Understood." }] });
  }
  for (const msg of messages) {
    contents.push({
      role: msg.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: msg.content }],
    });
  }

  const result = await model.generateContentStream({ contents });

  async function* streamText() {
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  }

  return streamText();
}
```

- [ ] **Step 3: Add GEMINI_API_KEY to .env.local**

```bash
# Append to .env.local (user should replace with their actual key)
echo 'GEMINI_API_KEY=your-gemini-api-key-here' >> /Users/visheshpaliwal/repo/lem-all/strategic-account-tracker/.env.local
```

- [ ] **Step 4: Verify build doesn't break**

```bash
npm run build
```
Expected: Build succeeds (gemini.ts is not imported anywhere yet).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/ai/gemini.ts
git commit -m "feat: add Gemini 2.5 Flash client wrapper"
```

---

## Task 2: Update Models — Signal + Account

**Files:**
- Modify: `src/lib/models/signal.ts`
- Modify: `src/lib/models/account.ts`

- [ ] **Step 1: Add relevanceScore and scoreReason to Signal model**

In `src/lib/models/signal.ts`, add to the `ISignal` interface:

```typescript
// Add after `date: Date;`
  relevanceScore?: number;
  scoreReason?: string;
```

Add to `SignalSchema` fields:

```typescript
// Add after `date: { type: Date, required: true },`
    relevanceScore: { type: Number, min: 1, max: 5 },
    scoreReason: { type: String },
```

- [ ] **Step 2: Add keywords to Account model**

In `src/lib/models/account.ts`, add to the `IAccount` interface:

```typescript
// Add after `lastTouchpoint?: Date;`
  keywords: string[];
```

Add to `AccountSchema` fields:

```typescript
// Add after `lastTouchpoint: { type: Date },`
    keywords: { type: [String], default: [] },
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/models/signal.ts src/lib/models/account.ts
git commit -m "feat: add relevanceScore, scoreReason to Signal; keywords to Account"
```

---

## Task 3: Scoring Logic

**Files:**
- Create: `src/lib/ai/scoring.ts`
- Create: `src/app/api/accounts/[id]/score/route.ts`

- [ ] **Step 1: Create scoring logic**

Create `src/lib/ai/scoring.ts`:

```typescript
import { generateJSON } from "./gemini";

interface AccountContext {
  name: string;
  type: string;
  stage: string;
  opportunityHypothesis: string;
  keywords: string[];
}

interface SignalInput {
  _id: string;
  title: string;
  source: string;
  type: string;
  date: string;
}

interface ScoreResult {
  signalId: string;
  score: number;
  reason: string;
}

const BATCH_SIZE = 20;

function buildScoringPrompt(account: AccountContext, signals: SignalInput[]): string {
  const signalList = signals
    .map((s, i) => `${i + 1}. [ID: ${s._id}] "${s.title}" (${s.type}, ${s.source}, ${new Date(s.date).toLocaleDateString()})`)
    .join("\n");

  return `Score each signal for relevance to this account tracked by a biomanufacturing/CDMO-focused investment firm.

Account: ${account.name} (${account.type}, stage: ${account.stage})
Opportunity Hypothesis: ${account.opportunityHypothesis}
${account.keywords.length > 0 ? `Keywords: ${account.keywords.join(", ")}` : ""}

Signals:
${signalList}

Score 1-5:
5 = Directly actionable for investment/partnership decision
4 = Highly relevant to account strategy
3 = Moderately relevant, worth reviewing
2 = Tangentially related
1 = Irrelevant noise

Return a JSON array: [{"signalId": "<the ID>", "score": <1-5>, "reason": "one-line explanation"}]
Only return the JSON array, nothing else.`;
}

export async function scoreSignals(
  account: AccountContext,
  signals: SignalInput[]
): Promise<ScoreResult[]> {
  if (signals.length === 0) return [];

  const allResults: ScoreResult[] = [];

  // Process in batches of BATCH_SIZE
  for (let i = 0; i < signals.length; i += BATCH_SIZE) {
    const batch = signals.slice(i, i + BATCH_SIZE);
    const prompt = buildScoringPrompt(account, batch);

    try {
      const results = await generateJSON<ScoreResult[]>(prompt);

      if (!Array.isArray(results)) continue;

      // Validate and clamp scores
      const validSignalIds = new Set(batch.map((s) => s._id));
      for (const r of results) {
        if (!validSignalIds.has(r.signalId)) continue; // ignore hallucinated IDs
        r.score = Math.max(1, Math.min(5, Math.round(r.score)));
        r.reason = r.reason || "";
        allResults.push(r);
      }
    } catch (err) {
      // Retry once on failure
      try {
        const results = await generateJSON<ScoreResult[]>(prompt);
        if (Array.isArray(results)) {
          const validSignalIds = new Set(batch.map((s) => s._id));
          for (const r of results) {
            if (!validSignalIds.has(r.signalId)) continue;
            r.score = Math.max(1, Math.min(5, Math.round(r.score)));
            r.reason = r.reason || "";
            allResults.push(r);
          }
        }
      } catch {
        // Skip this batch — signals remain unscored
        console.error("Scoring failed for batch, skipping:", err);
      }
    }
  }

  return allResults;
}
```

- [ ] **Step 2: Create score API endpoint**

Create `src/app/api/accounts/[id]/score/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Account from "@/lib/models/account";
import Signal from "@/lib/models/signal";
import { scoreSignals } from "@/lib/ai/scoring";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;

  const account = await Account.findById(id).lean();
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check if rescore mode (clear existing scores first)
  const body = await request.json().catch(() => ({}));
  if (body.rescore) {
    await Signal.updateMany(
      { accountId: id, status: "Suggested" },
      { $unset: { relevanceScore: "", scoreReason: "" } }
    );
  }

  // Fetch unscored Suggested signals
  const unscoredSignals = await Signal.find({
    accountId: id,
    status: "Suggested",
    relevanceScore: null,
  }).lean();

  if (unscoredSignals.length === 0) {
    return NextResponse.json({ scored: 0, dismissed: 0 });
  }

  const scores = await scoreSignals(
    {
      name: account.name,
      type: account.type,
      stage: account.stage,
      opportunityHypothesis: account.opportunityHypothesis,
      keywords: account.keywords || [],
    },
    unscoredSignals.map((s) => ({
      _id: s._id.toString(),
      title: s.title,
      source: s.source,
      type: s.type,
      date: s.date.toISOString(),
    }))
  );

  let dismissed = 0;

  // Update signals with scores
  for (const { signalId, score, reason } of scores) {
    const update: Record<string, unknown> = { relevanceScore: score, scoreReason: reason };
    if (score < 2) {
      update.status = "Dismissed";
      dismissed++;
    }
    await Signal.findByIdAndUpdate(signalId, update);
  }

  return NextResponse.json({ scored: scores.length, dismissed });
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/scoring.ts src/app/api/accounts/\[id\]/score/route.ts
git commit -m "feat: add signal relevance scoring with Gemini 2.5 Flash"
```

---

## Task 4: Keyword-Enhanced Enrichment

**Files:**
- Modify: `src/lib/enrichment/serper.ts`
- Modify: `src/lib/enrichment/rss.ts`
- Modify: `src/lib/enrichment/enrich.ts`
- Modify: `src/app/api/accounts/[id]/enrich/route.ts`

- [ ] **Step 1: Update serper.ts to accept keywords**

In `src/lib/enrichment/serper.ts`, change the function signature and query:

```typescript
// Change function signature from:
export async function searchSerper(companyName: string): Promise<SerperResult[]> {

// To:
export async function searchSerper(companyName: string, keywords: string[] = []): Promise<SerperResult[]> {
```

Replace the query construction:

```typescript
// Replace:
      body: JSON.stringify({
        q: `"${companyName}" news OR announcement OR funding OR hiring`,
        num: 5,
      }),

// With:
      body: JSON.stringify({
        q: keywords.length > 0
          ? `"${companyName}" ${keywords.join(" OR ")} news OR announcement`
          : `"${companyName}" news OR announcement OR funding OR hiring`,
        num: 5,
      }),
```

- [ ] **Step 2: Update rss.ts to accept keywords**

In `src/lib/enrichment/rss.ts`, change the function signature and query:

```typescript
// Change from:
export async function fetchNewsRss(companyName: string): Promise<RssItem[]> {

// To:
export async function fetchNewsRss(companyName: string, keywords: string[] = []): Promise<RssItem[]> {
```

Replace the query construction:

```typescript
// Replace:
    const query = encodeURIComponent(companyName);

// With:
    const queryStr = keywords.length > 0
      ? `${companyName} ${keywords.join(" ")}`
      : companyName;
    const query = encodeURIComponent(queryStr);
```

- [ ] **Step 3: Update enrich.ts to accept and pass keywords**

In `src/lib/enrichment/enrich.ts`, change the function signature:

```typescript
// Change from:
export async function enrichAccount(accountId: string, companyName: string): Promise<number> {

// To:
export async function enrichAccount(accountId: string, companyName: string, keywords: string[] = []): Promise<number> {
```

Update the parallel fetch calls:

```typescript
// Replace:
  const [serperResults, rssResults] = await Promise.all([
    searchSerper(companyName),
    fetchNewsRss(companyName),
  ]);

// With:
  const [serperResults, rssResults] = await Promise.all([
    searchSerper(companyName, keywords),
    fetchNewsRss(companyName, keywords),
  ]);
```

- [ ] **Step 4: Update enrich route to pass keywords and chain scoring**

Replace `src/app/api/accounts/[id]/enrich/route.ts` entirely:

```typescript
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Account from "@/lib/models/account";
import Signal from "@/lib/models/signal";
import { enrichAccount } from "@/lib/enrichment/enrich";
import { scoreSignals } from "@/lib/ai/scoring";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const account = await Account.findById(id).lean();
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Enrich with keywords
  const newSignals = await enrichAccount(id, account.name, account.keywords || []);

  // Chain scoring for new unscored signals
  let scored = 0;
  let dismissed = 0;

  if (newSignals > 0) {
    const unscoredSignals = await Signal.find({
      accountId: id,
      status: "Suggested",
      relevanceScore: null,
    }).lean();

    if (unscoredSignals.length > 0) {
      const scores = await scoreSignals(
        {
          name: account.name,
          type: account.type,
          stage: account.stage,
          opportunityHypothesis: account.opportunityHypothesis,
          keywords: account.keywords || [],
        },
        unscoredSignals.map((s) => ({
          _id: s._id.toString(),
          title: s.title,
          source: s.source,
          type: s.type,
          date: s.date.toISOString(),
        }))
      );

      for (const { signalId, score, reason } of scores) {
        const update: Record<string, unknown> = { relevanceScore: score, scoreReason: reason };
        if (score < 2) {
          update.status = "Dismissed";
          dismissed++;
        }
        await Signal.findByIdAndUpdate(signalId, update);
      }
      scored = scores.length;
    }
  }

  return NextResponse.json({ newSignals, scored, dismissed });
}
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/enrichment/serper.ts src/lib/enrichment/rss.ts src/lib/enrichment/enrich.ts src/app/api/accounts/\[id\]/enrich/route.ts
git commit -m "feat: keyword-enhanced enrichment with chained scoring"
```

---

## Task 5: Update Signals API Sort Order

**Files:**
- Modify: `src/app/api/accounts/[id]/signals/route.ts`

- [ ] **Step 1: Update sort order**

In `src/app/api/accounts/[id]/signals/route.ts`, add the `Types` import at the top and replace the GET handler with an aggregation pipeline to handle nulls-last sorting (MongoDB sorts nulls FIRST in descending order, so we need `$ifNull`):

```typescript
// Add import at top of file:
import { Types } from "mongoose";

// Replace the entire GET handler with:

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const signals = await Signal.aggregate([
    { $match: { accountId: new Types.ObjectId(id), status: { $ne: "Dismissed" } } },
    { $addFields: { hasScore: { $cond: [{ $ifNull: ["$relevanceScore", false] }, 1, 0] } } },
    { $sort: { hasScore: -1, relevanceScore: -1, date: -1 } },
    { $project: { hasScore: 0 } },
  ]);
  return NextResponse.json(signals);
}
```

This puts scored signals first (sorted by score desc), then unscored (sorted by date desc).

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/accounts/\[id\]/signals/route.ts
git commit -m "feat: sort signals by relevance score (desc), then date"
```

---

## Task 6: Chat Streaming Endpoint

**Files:**
- Create: `src/app/api/accounts/[id]/chat/route.ts`

- [ ] **Step 1: Create chat API route**

Create `src/app/api/accounts/[id]/chat/route.ts`:

```typescript
import { NextRequest } from "next/server";
import dbConnect from "@/lib/mongodb";
import Account from "@/lib/models/account";
import Signal from "@/lib/models/signal";
import { generateStream } from "@/lib/ai/gemini";

export const dynamic = "force-dynamic";

function buildSystemPrompt(account: Record<string, unknown>, signals: Record<string, unknown>[]): string {
  const signalList = signals
    .slice(0, 15) // Top 15 by score
    .map((s) => {
      const score = s.relevanceScore ? `[${s.relevanceScore}/5]` : "[unscored]";
      const reason = s.scoreReason ? ` — ${s.scoreReason}` : "";
      return `${score} ${s.title} (${s.type}, ${s.source}, ${new Date(s.date as string).toLocaleDateString()})${reason}`;
    })
    .join("\n");

  return `You are an AI assistant for a strategic account tracker used by a biomanufacturing/CDMO-focused investment firm (Lemniscate).

You are viewing account: ${account.name}
Type: ${account.type} | Stage: ${account.stage}
Opportunity Hypothesis: ${account.opportunityHypothesis}
${account.founderNote ? `Founder Notes: ${account.founderNote}` : ""}
${(account.keywords as string[])?.length > 0 ? `Keywords: ${(account.keywords as string[]).join(", ")}` : "No keywords set"}
Last Touchpoint: ${account.lastTouchpoint ? new Date(account.lastTouchpoint as string).toLocaleDateString() : "None"}
Next Action: ${account.nextAction || "None"}${account.nextActionDate ? ` (due: ${new Date(account.nextActionDate as string).toLocaleDateString()})` : ""}

Current signals (sorted by relevance):
${signalList || "No signals yet"}

You can:
1. Explain why any signal is relevant to Lemniscate's thesis
2. Suggest keywords to track — when suggesting, include this exact JSON format in your response: {"suggestedKeywords": ["keyword1", "keyword2"]}
3. Give a 30-second briefing on the account
4. Recommend concrete next actions based on signals and stage
5. Answer freeform questions about the account

Be concise. Speak like a smart analyst briefing a founder.`;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;

  const account = await Account.findById(id).lean();
  if (!account) {
    return new Response("Account not found", { status: 404 });
  }

  const body = await request.json();
  const messages: { role: "user" | "model"; content: string }[] = (body.messages || []).slice(-10);

  // Fetch top signals for context
  const signals = await Signal.find({ accountId: id, status: { $ne: "Dismissed" } })
    .sort({ relevanceScore: -1, date: -1 })
    .limit(15)
    .lean();

  const systemPrompt = buildSystemPrompt(account, signals);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const gen = await generateStream(messages, systemPrompt);
        for await (const chunk of gen) {
          controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: [ERROR] ${msg}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/accounts/\[id\]/chat/route.ts
git commit -m "feat: add AI chat streaming endpoint (SSE)"
```

---

## Task 7: KeywordChips Component

**Files:**
- Create: `src/components/KeywordChips.tsx`

- [ ] **Step 1: Create KeywordChips component**

Create `src/components/KeywordChips.tsx`:

```tsx
"use client";

import { useState } from "react";

interface Props {
  keywords: string[];
  onAdd: (keyword: string) => void;
  onRemove: (keyword: string) => void;
}

export default function KeywordChips({ keywords, onAdd, onRemove }: Props) {
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const kw = input.trim().toLowerCase();
    if (kw && !keywords.includes(kw)) {
      onAdd(kw);
      setInput("");
    }
  };

  return (
    <div className="rounded-lg bg-gray-900 p-4">
      <div className="text-xs font-medium text-gray-500 mb-2">KEYWORDS</div>
      <div className="flex flex-wrap gap-2 mb-2">
        {keywords.map((kw) => (
          <span
            key={kw}
            className="inline-flex items-center gap-1 rounded-full bg-blue-900/40 px-3 py-1 text-xs text-blue-300"
          >
            {kw}
            <button
              onClick={() => onRemove(kw)}
              className="ml-1 text-blue-400 hover:text-red-400"
            >
              ×
            </button>
          </span>
        ))}
        {keywords.length === 0 && (
          <span className="text-xs text-gray-600">No keywords — using default search</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add keyword..."
          className="flex-1 rounded bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={handleAdd}
          disabled={!input.trim()}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/KeywordChips.tsx
git commit -m "feat: add KeywordChips component"
```

---

## Task 8: SignalTimeline — Score Badge & Tooltip

**Files:**
- Modify: `src/components/SignalTimeline.tsx`

- [ ] **Step 1: Update Signal interface and add score display**

In `src/components/SignalTimeline.tsx`, update the `Signal` interface:

```typescript
// Replace the Signal interface with:
interface Signal {
  _id: string;
  type: string;
  source: string;
  title: string;
  note?: string;
  url?: string;
  status: string;
  date: string;
  relevanceScore?: number;
  scoreReason?: string;
}
```

- [ ] **Step 2: Add score badge to signal cards**

In the signal card rendering, add a score badge. After the date/status line (line ~33), add a score badge:

```typescript
// After the date · status line, before the title, add:
              {signal.relevanceScore && (
                <span
                  className={`ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-bold ${
                    signal.relevanceScore >= 4
                      ? "bg-green-900/50 text-green-400"
                      : signal.relevanceScore >= 3
                        ? "bg-blue-900/50 text-blue-400"
                        : "bg-gray-800 text-gray-500"
                  }`}
                  title={signal.scoreReason || ""}
                >
                  {signal.relevanceScore}/5
                </span>
              )}
```

This should be inserted inside the date/status `<div>` element, after the status span.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/SignalTimeline.tsx
git commit -m "feat: add relevance score badge to signal timeline"
```

---

## Task 9: AI Chat Components

**Files:**
- Create: `src/components/AiChatButton.tsx`
- Create: `src/components/AiChat.tsx`

- [ ] **Step 1: Create AiChatButton**

Create `src/components/AiChatButton.tsx`:

```tsx
"use client";

interface Props {
  onClick: () => void;
}

export default function AiChatButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 flex items-center gap-2"
      title="AI Assistant"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
      AI
    </button>
  );
}
```

- [ ] **Step 2: Create AiChat panel**

Create `src/components/AiChat.tsx`:

```tsx
"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "model";
  content: string;
}

interface Props {
  accountId: string;
  onClose: () => void;
  onKeywordsAccepted: (keywords: string[]) => void;
}

function parseSuggestedKeywords(text: string): string[] | null {
  // Strip markdown code fences
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
  const match = cleaned.match(/\{"suggestedKeywords"\s*:\s*\[.*?\]\}/s);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (Array.isArray(parsed.suggestedKeywords)) {
      return parsed.suggestedKeywords.filter((k: unknown) => typeof k === "string");
    }
  } catch {
    // Silent fail — show as plain text
  }
  return null;
}

export default function AiChat({ accountId, onClose, onKeywordsAccepted }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const quickActions = [
    "Brief me on this account",
    "Suggest keywords",
    "What should I do next?",
  ];

  const sendMessage = async (content: string) => {
    if (!content.trim() || streaming) return;

    const userMsg: Message = { role: "user", content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Add placeholder for assistant response
    const assistantMsg: Message = { role: "model", content: "" };
    setMessages([...newMessages, assistantMsg]);

    try {
      const res = await fetch(`/api/accounts/${accountId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok || !res.body) throw new Error("Chat request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          if (data.startsWith("[ERROR]")) {
            fullText += "\n\n⚠️ " + data.slice(8);
            break;
          }
          fullText += data;
        }

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "model", content: fullText };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "model",
          content: "Sorry, I couldn't process that request. Please try again.",
        };
        return updated;
      });
    }

    setStreaming(false);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-[400px] flex-col border-l border-gray-800 bg-gray-950 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <span className="text-sm font-bold text-white">AI Assistant</span>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white">
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">Quick actions:</p>
            {quickActions.map((action) => (
              <button
                key={action}
                onClick={() => sendMessage(action)}
                className="block w-full rounded-lg border border-gray-800 px-3 py-2 text-left text-sm text-gray-400 hover:border-purple-600 hover:text-white"
              >
                {action}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`${msg.role === "user" ? "text-right" : ""}`}>
            <div
              className={`inline-block max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-900 text-gray-300"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* Render keyword suggestions as chips */}
              {msg.role === "model" && !streaming && (() => {
                const keywords = parseSuggestedKeywords(msg.content);
                if (!keywords) return null;
                return (
                  <div className="mt-2 flex flex-wrap gap-1 border-t border-gray-800 pt-2">
                    {keywords.map((kw) => (
                      <button
                        key={kw}
                        onClick={() => onKeywordsAccepted([kw])}
                        className="rounded-full bg-purple-900/40 px-2 py-0.5 text-xs text-purple-300 hover:bg-purple-800"
                      >
                        + {kw}
                      </button>
                    ))}
                    <button
                      onClick={() => onKeywordsAccepted(keywords)}
                      className="rounded-full bg-purple-600 px-2 py-0.5 text-xs text-white hover:bg-purple-700"
                    >
                      Add all
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        ))}

        {streaming && (
          <div className="text-xs text-gray-600">Thinking...</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            placeholder="Ask about this account..."
            disabled={streaming}
            className="flex-1 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming}
            className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/AiChatButton.tsx src/components/AiChat.tsx
git commit -m "feat: add AI chat panel with streaming and keyword suggestions"
```

---

## Task 10: Wire Everything into the Account Detail Page

**Files:**
- Modify: `src/app/accounts/[id]/page.tsx`

This is the integration task — connecting keywords, chat, scoring, and updated toast messages.

- [ ] **Step 1: Update the Signal interface in page.tsx**

```typescript
// Replace the Signal interface with:
interface Signal {
  _id: string;
  type: string;
  source: string;
  title: string;
  note?: string;
  url?: string;
  status: string;
  date: string;
  relevanceScore?: number;
  scoreReason?: string;
}
```

- [ ] **Step 2: Update the Account interface**

```typescript
// Add to Account interface, after lastTouchpoint:
  keywords?: string[];
```

- [ ] **Step 3: Add imports**

```typescript
// Add these imports at the top:
import KeywordChips from "@/components/KeywordChips";
import AiChatButton from "@/components/AiChatButton";
import AiChat from "@/components/AiChat";
```

- [ ] **Step 4: Add state for chat**

```typescript
// Add after the existing useState declarations:
  const [showChat, setShowChat] = useState(false);
```

- [ ] **Step 5: Add keyword handlers**

```typescript
// Add after handleEnrich function:
  const handleAddKeyword = async (keyword: string) => {
    if (!account) return;
    const existing = account.keywords || [];
    if (existing.includes(keyword)) return;
    const updated = [...existing, keyword];
    await fetch(`/api/accounts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: updated }),
    });
    await fetchAccount();
    handleEnrich();
  };

  const handleRemoveKeyword = async (keyword: string) => {
    if (!account) return;
    const updated = (account.keywords || []).filter((k) => k !== keyword);
    await fetch(`/api/accounts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: updated }),
    });
    fetchAccount();
  };

  const handleRescore = async () => {
    setEnriching(true);
    try {
      const res = await fetch(`/api/accounts/${id}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rescore: true }),
      });
      const data = await res.json();
      setToast({ message: `Re-scored ${data.scored} signal(s), dismissed ${data.dismissed}`, type: "success" });
      fetchSignals();
    } catch {
      setToast({ message: "Scoring failed", type: "error" });
    }
    setEnriching(false);
  };
```

- [ ] **Step 6: Update handleEnrich toast messages**

```typescript
// Replace the handleEnrich function:
  const handleEnrich = async () => {
    setEnriching(true);
    try {
      const res = await fetch(`/api/accounts/${id}/enrich`, { method: "POST" });
      const data = await res.json();
      if (data.newSignals > 0) {
        setToast({
          message: `Found ${data.newSignals} signal(s), scored ${data.scored}, dismissed ${data.dismissed}`,
          type: "success",
        });
      } else {
        setToast({ message: "No new signals found", type: "info" });
      }
      fetchSignals();
    } catch {
      setToast({ message: "Enrichment unavailable", type: "error" });
    }
    setEnriching(false);
  };
```

- [ ] **Step 7: Add AI button to header**

In the header buttons `<div className="flex gap-2">`, add the AI button before Edit:

```tsx
          <AiChatButton onClick={() => setShowChat(true)} />
```

- [ ] **Step 8: Add Re-score button after Refresh Signals button**

```tsx
          <button
            onClick={handleRescore}
            disabled={enriching}
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50"
          >
            Re-score
          </button>
```

- [ ] **Step 9: Add KeywordChips to left column**

After the founder note section and before the grid with next action/last touchpoint, add:

```tsx
          <KeywordChips
            keywords={account.keywords || []}
            onAdd={handleAddKeyword}
            onRemove={handleRemoveKeyword}
          />
```

- [ ] **Step 10: Add AiChat panel**

After the Toast component, before the closing `</div>`:

```tsx
      {showChat && (
        <AiChat
          accountId={id}
          onClose={() => setShowChat(false)}
          onKeywordsAccepted={async (newKeywords) => {
            if (!account) return;
            const existing = account.keywords || [];
            const unique = newKeywords.filter((kw) => !existing.includes(kw));
            if (unique.length === 0) return;
            const updated = [...existing, ...unique];
            await fetch(`/api/accounts/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ keywords: updated }),
            });
            await fetchAccount();
            handleEnrich();
          }}
        />
      )}
```

- [ ] **Step 11: Update enriching button text**

```typescript
// Replace:
            {enriching ? "Refreshing..." : "Refresh Signals"}
// With:
            {enriching ? "Refreshing & Scoring..." : "Refresh Signals"}
```

- [ ] **Step 12: Verify build and test manually**

```bash
npm run build && npm run dev
```

Open an account detail page in the browser. Verify:
1. Keyword chips section appears (empty by default)
2. AI button appears in header
3. Clicking AI button opens chat panel
4. Refresh Signals now shows "Refreshing & Scoring..."
5. Re-score button is visible

- [ ] **Step 13: Commit**

```bash
git add src/app/accounts/\[id\]/page.tsx
git commit -m "feat: integrate keywords, AI chat, and scoring into account detail page"
```

---

## Task 11: Manual Smoke Test

This is not automated — it requires a real Gemini API key.

- [ ] **Step 1: Ensure GEMINI_API_KEY is set in .env.local**

Verify `GEMINI_API_KEY` is set to a real key (not the placeholder).

- [ ] **Step 2: Open an account with existing signals**

Navigate to any account detail page (e.g., one of the seed accounts).

- [ ] **Step 3: Test Refresh Signals (enrichment + scoring)**

Click "Refresh Signals". Verify:
- Toast shows signal count + scored count + dismissed count
- Signals in timeline now show score badges (1-5)
- Signals are sorted by score (highest first)
- Irrelevant signals (score < 2) disappear from feed

- [ ] **Step 4: Test keyword management**

- Add a keyword (e.g., "cell therapy") via the chips input
- Verify it appears as a chip
- Click "Refresh Signals" again — new enrichment should use the keyword
- Remove the keyword via the × button

- [ ] **Step 5: Test AI chat**

- Click the AI button → chat panel opens
- Click "Brief me on this account" → streaming response appears
- Click "Suggest keywords" → response includes keyword chips with "Add" buttons
- Click a keyword chip → keyword is added to account, enrichment auto-triggers
- Ask a freeform question → response is contextual
- Close chat panel with ✕

- [ ] **Step 6: Test Re-score**

- Click "Re-score" → scores any remaining unscored signals
- Verify toast shows scored/dismissed counts

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: smoke test fixes for smart signal layer"
```
