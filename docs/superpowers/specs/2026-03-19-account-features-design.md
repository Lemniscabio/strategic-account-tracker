# Strategic Account Tracker — Feature Batch Design

**Date:** 2026-03-19
**Features:** Account Tiering, Touchpoint Timeline, Focus View, AI Chat Prompt Rewrite

---

## 1. Account Tiering (A/B/C)

### Schema Change
Add `tier` field to Account model:
- Type: String enum `['A', 'B', 'C']`
- Required, default: `'C'`

### Constants
Add to `src/lib/constants.ts`:
```ts
export const ACCOUNT_TIERS = ['A', 'B', 'C'] as const;
export type AccountTier = (typeof ACCOUNT_TIERS)[number];
```

### Account Form
- Add tier select dropdown to `AccountForm.tsx` (between Type and Stage fields)
- Options: A, B, C with default C

### Dashboard Table
- Add Tier column to `AccountTable.tsx` (after Account name)
- Tier badges: A = green (`bg-emerald-900 text-emerald-300`), B = blue (`bg-blue-900 text-blue-300`), C = gray (`bg-gray-700 text-gray-400`)
- Primary sort: tier (A > B > C), secondary sort: `nextActionDate` ASC

### API Changes
- `GET /api/accounts` — include tier in response, update sort logic
- `POST /api/accounts` — accept tier field
- `PUT /api/accounts/[id]` — accept tier field

### Filters
- Add tier filter to `AccountFilters.tsx`
- Update `AccountTable.tsx` to manage `tier` filter state, pass it as prop to `AccountFilters`, and include it in the fetch URL query params
- Handle `tier` query param in `GET /api/accounts` route

### Sort Implementation
Mongo sort: `{ tier: 1, nextActionDate: 1 }` — works naturally since A < B < C in ASCII order.

---

## 2. Touchpoint Timeline

### Schema Change
Add embedded `touchpoints` array to Account model:
```
touchpoints: [{
  date: Date (required),
  note: String (required),
  outcome: String (optional, default "")
}]
```

Keep `lastTouchpoint` field — auto-update it to the most recent touchpoint date whenever touchpoints array is modified.

### Account Creation
On account creation, auto-create an initial touchpoint:
```
{ date: Date.now(), note: "Started tracking", outcome: "" }
```
Set `lastTouchpoint` to the same date.

### Account Detail Page
- New "Touchpoints" section on the left column (below existing fields)
- "+ Add Touchpoint" button opens a modal form with: date picker, note textarea, outcome textarea
- Displays as a vertical mini-timeline (most recent first)
- Each entry: date (bold), note, outcome (if present, in muted text)

### API Changes
- Create new file: `src/app/api/accounts/[id]/touchpoints/route.ts`
  - `POST` — add a touchpoint, auto-update `lastTouchpoint` to max date in array
- Touchpoints returned as part of `GET /api/accounts/[id]` response (already embedded)

### New Components (in `src/components/`)
- `TouchpointForm.tsx` — modal for adding a touchpoint (date, note, outcome)
- `TouchpointTimeline.tsx` — vertical timeline display

### Note
`lastTouchpoint` is not currently in `AccountForm.tsx` — it is display-only on the detail page. No form removal needed. The field is now auto-derived from the touchpoints array.

---

## 3. Focus View ("Today's Focus")

### API Endpoint
`GET /api/dashboard/focus`

Returns three buckets:

**Overdue Actions:**
- Query: `nextAction` exists AND `nextActionDate <= today`
- Returns: account name, tier, nextAction text, days overdue
- Sorted by: days overdue DESC

**New Signals:**
- Query: signals with `status = "Suggested"`, grouped by accountId
- Returns: account name, tier, signal count, latest signal title
- Sorted by: signal count DESC

**Stale Accounts:**
- Query: accounts where `lastTouchpoint` is older than tier-based threshold
  - Tier A: 7 days
  - Tier B: 14 days
  - Tier C: 30 days
- Excludes accounts with stage "Churned"
- Returns: account name, tier, days since last touchpoint, last touchpoint note
- Sorted by: staleness ratio DESC (days / threshold)

### New Files
- `src/app/api/dashboard/focus/route.ts` — API endpoint
- `src/components/FocusView.tsx` — frontend component

### Frontend Component
`FocusView.tsx` — collapsible section at top of dashboard (between KPI cards and account table).

- Expanded by default
- Header: "Today's Focus" with total item count
- Collapsible with chevron toggle
- Three columns (responsive: stack on mobile):
  - Overdue Actions (red dot, red count badge)
  - New Signals (yellow dot, yellow count badge)
  - Stale Accounts (blue dot, blue count badge)
- Each item is clickable, navigates to `/accounts/[id]`
- Shows tier badge next to account name
- Empty state: "Nothing here" per section

### Dashboard Page
Update `src/app/page.tsx` to include `<FocusView />` between `<KpiCards />` and `<AccountTable />`.

---

## 4. AI Chat System Prompt Rewrite

### Location
`src/app/api/accounts/[id]/chat/route.ts` — `buildSystemPrompt` function

### Context Injection
The prompt now receives:
- Account: name, type, stage, **tier**, hypothesis, founder note, keywords
- **Full touchpoint timeline** (all entries, not just lastTouchpoint date)
- **All non-dismissed signals** (title, URL, status — includes both Suggested and Confirmed so user can discuss and act on any active signal)
- **Staleness status**: days since last touchpoint, tier threshold, whether stale

### Prompt Structure

**Persona:** You are a strategic account intelligence analyst for Lemniscate, a biomanufacturing and CDMO-focused investment and advisory firm.

**Formatting rules:**
- Always use bullet points for lists
- Use **bold** for key terms, company names, and action items
- Use headers (##) to organize longer responses
- Keep sentences concise and specific to this account's data
- Never use generic filler — every sentence references actual data
- End actionable responses with a "**Suggested next step:**" line

**Response modes:**
1. **Briefing** (triggered by "brief me" or similar):
   - Account tier and stage context
   - Last touchpoint summary + staleness warning if applicable
   - Top 3 recent signals with relevance
   - Recommended priority level

2. **Action planning** (triggered by "what should I do next" or similar):
   - Current stage and natural next steps
   - Overdue actions if any
   - Signal-driven opportunities
   - Concrete next action with suggested timeline

3. **Signal analysis** (triggered by asking about specific signals):
   - Why this signal matters for the opportunity hypothesis
   - Connection to biomanufacturing/CDMO thesis
   - Implications for account stage progression

4. **Keyword suggestions** (triggered by "suggest keywords"):
   - Return JSON: `{"suggestedKeywords": ["kw1", "kw2"]}`
   - Based on gaps in current keyword coverage vs account context

**Constraints:**
- Never mention tools, browsing, or internal processes
- Never say "I don't have access to" — use the data provided
- If asked something outside the account context, say so briefly and redirect

---

## Technical Notes

- All schema changes are additive (no breaking changes to existing data)
- Existing accounts without `tier` field default to `'C'` via schema default
- Existing accounts without `touchpoints` array get empty array via schema default
- The `lastTouchpoint` field is preserved for backward-compatible queries (focus view staleness, dashboard)
- Mockup reference: `mockup-focus-view.html` (to be deleted after implementation)
- Accounts with no `lastTouchpoint` and no touchpoints are excluded from staleness checks (they have no baseline to measure against)
- The `GET /api/dashboard/stats` endpoint remains unchanged — it coexists with the new `/api/dashboard/focus` endpoint (different purposes: counts vs actionable items)
- Chat `buildSystemPrompt` must iterate over the touchpoints array and compute staleness (days since last touchpoint vs tier threshold)
