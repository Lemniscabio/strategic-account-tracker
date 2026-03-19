# Solution Design Doc — Strategic Account Tracker

**Product:** Strategic Account Tracker
**Builder:** Vishesh Paliwal
**Date:** 19 March 2026
**Sprint:** Lemnisca Product Development Sprint

---

## 1. App structure / architecture

Next.js 14 App Router monolith:

```
strategic-account-tracker/
├── src/
│   ├── app/                          # Next.js App Router pages + API routes
│   │   ├── page.tsx                  # Dashboard (KPI cards + Focus View + Account table)
│   │   ├── layout.tsx                # Root layout with Header
│   │   ├── globals.css               # Tailwind imports
│   │   ├── accounts/
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Account detail (context + signals + touchpoints)
│   │   └── api/
│   │       ├── accounts/
│   │       │   ├── route.ts          # GET (list + filter + sort) / POST (create)
│   │       │   └── [id]/
│   │       │       ├── route.ts      # GET / PUT / DELETE
│   │       │       ├── signals/
│   │       │       │   └── route.ts  # GET (list) / POST (add manual signal)
│   │       │       ├── enrich/
│   │       │       │   └── route.ts  # POST (search + score signals)
│   │       │       ├── score/
│   │       │       │   └── route.ts  # POST (re-score existing signals)
│   │       │       ├── chat/
│   │       │       │   └── route.ts  # POST (AI chat with Gemini)
│   │       │       ├── chats/
│   │       │       │   ├── route.ts  # GET (list threads) / POST (create thread)
│   │       │       │   └── [threadId]/
│   │       │       │       └── route.ts  # GET / PUT / DELETE thread
│   │       │       └── touchpoints/
│   │       │           └── route.ts  # POST (add touchpoint)
│   │       ├── signals/
│   │       │   └── [id]/
│   │       │       └── route.ts      # PUT (confirm/dismiss) / DELETE
│   │       └── dashboard/
│   │           ├── stats/
│   │           │   └── route.ts      # GET (KPI counts)
│   │           └── focus/
│   │               └── route.ts      # GET (overdue + signals + stale)
│   ├── components/
│   │   ├── Header.tsx                # Top nav with "Add Account" button
│   │   ├── KpiCards.tsx              # Dashboard stat cards
│   │   ├── FocusView.tsx             # Collapsible overdue/signals/stale section
│   │   ├── AccountTable.tsx          # Filterable, sortable account list
│   │   ├── AccountFilters.tsx        # Search + type/stage/tier filter dropdowns
│   │   ├── AccountForm.tsx           # Create/edit account modal
│   │   ├── SignalTimeline.tsx        # Signal list with confirm/dismiss actions
│   │   ├── SignalForm.tsx            # Add manual signal modal
│   │   ├── TouchpointForm.tsx        # Add touchpoint modal
│   │   ├── TouchpointTimeline.tsx    # Vertical touchpoint history
│   │   ├── AiChat.tsx                # Chat panel with thread persistence
│   │   ├── AiChatButton.tsx          # Chat toggle button
│   │   ├── KeywordChips.tsx          # Keyword add/remove chips
│   │   ├── TierBadge.tsx             # A/B/C colored badge
│   │   ├── StageBadge.tsx            # Pipeline stage badge
│   │   ├── TypeBadge.tsx             # Account type badge
│   │   └── Toast.tsx                 # Notification toast
│   └── lib/
│       ├── constants.ts              # Enums: types, stages, tiers, signal types, statuses
│       ├── mongodb.ts                # Mongoose connection with caching
│       ├── models/
│       │   ├── account.ts            # Account schema (tier, touchpoints, keywords)
│       │   ├── signal.ts             # Signal schema (type, score, status)
│       │   └── chatThread.ts         # Chat thread schema (messages, sources)
│       ├── ai/
│       │   ├── gemini.ts             # Gemini client (chat + JSON generation)
│       │   ├── scoring.ts            # Batch signal scoring logic
│       │   └── tavily.ts             # Tavily client for chat grounding
│       └── enrichment/
│           ├── enrich.ts             # Orchestrates search + dedup + score pipeline
│           ├── categorize.ts         # Signal type detection from title
│           ├── serper.ts             # Serper search integration
│           ├── rss.ts                # Google News RSS parsing
│           └── tavily.ts             # Tavily search with snippets
├── tailwind.config.ts
├── next.config.js
└── package.json
```

**Architecture pattern:** Next.js App Router full-stack. React Server Components for pages, Client Components for interactive UI. API routes handle all server-side logic. No separate backend process.

## 2. Major components

### Frontend (React + TypeScript)

| Component | Responsibility |
|-----------|---------------|
| `page.tsx` (dashboard) | Top-level dashboard. Renders KPI cards, Focus View, and Account table. |
| `KpiCards.tsx` | Fetches `/api/dashboard/stats` and displays 4 metric cards: total accounts, active pilots, pending actions, new signals. |
| `FocusView.tsx` | Fetches `/api/dashboard/focus`. Collapsible 3-column panel showing overdue actions, new signals, and stale accounts. Each item clickable to navigate to account detail. Expanded by default. Hidden when empty. |
| `AccountTable.tsx` | Fetches `/api/accounts` with search/type/stage/tier query params. Manages filter state. Renders sortable table with tier badge, type badge, stage badge, latest signal, and next action columns. Click navigates to account detail. |
| `AccountFilters.tsx` | Search input + type/stage/tier select dropdowns. Controlled by AccountTable parent. |
| `AccountForm.tsx` | Modal form for create/edit. Fields: name, type, tier, stage, hypothesis, founder note, website, LinkedIn, next action, due date. |
| `page.tsx` (detail) | Account detail page. Two-column layout: left (context, keywords, touchpoints), right (signal timeline). Header with tier/type/stage badges and action buttons. |
| `SignalTimeline.tsx` | Vertical timeline of signals. Confirmed signals show green badge. Suggested signals show yellow highlight with confirm/dismiss buttons. Relevance scores as colored badges. |
| `TouchpointTimeline.tsx` | Vertical timeline of touchpoints sorted newest-first. Each entry shows date, note, and outcome. |
| `AiChat.tsx` | Slide-out right panel. Persistent chat threads with auto-save. Thread selector dropdown, "New Chat" button. Quick actions for briefing, keywords, next steps. Renders markdown with ReactMarkdown + Tailwind Typography. Post-processes AI output for consistent formatting. |
| `KeywordChips.tsx` | Chip display with add/remove. Adding a keyword triggers enrichment. |
| `TierBadge.tsx` | Colored badge: A=green, B=blue, C=gray. |

### Backend (API Routes + Mongoose)

| Component | Responsibility |
|-----------|---------------|
| `accounts/route.ts` | List with search/type/stage/tier filters. Sort by tier ASC then nextActionDate ASC. POST creates account with auto-initial touchpoint. |
| `accounts/[id]/route.ts` | Single account CRUD. DELETE cascades to signals and chat threads. |
| `accounts/[id]/signals/route.ts` | List non-dismissed signals for account. POST adds manual signal. |
| `accounts/[id]/enrich/route.ts` | Orchestrates 3-source parallel search, deduplication, signal creation, AI scoring, and auto-dismiss. |
| `accounts/[id]/score/route.ts` | Re-scores existing signals in batches of 20. |
| `accounts/[id]/chat/route.ts` | AI chat via Gemini 2.5 Pro with systemInstruction. Loads all non-dismissed signals + touchpoints + tier/staleness context. |
| `accounts/[id]/chats/route.ts` | List and create chat threads per account. |
| `accounts/[id]/touchpoints/route.ts` | Add touchpoint, auto-update lastTouchpoint. |
| `dashboard/stats/route.ts` | Aggregated counts for KPI cards. |
| `dashboard/focus/route.ts` | Three queries: overdue actions, suggested signals grouped by account, stale accounts by tier threshold. |

### AI & Enrichment Pipeline

| Component | Responsibility |
|-----------|---------------|
| `gemini.ts` | Gemini client. `generateJSON` for structured output (scoring). `generateChatResponse` with systemInstruction + Google Search + URL Context grounding tools. |
| `scoring.ts` | Batch scores signals against account context using Gemini Flash. Batches of 20. Returns score (1-5) + reason per signal. Auto-dismisses < 2. |
| `enrich.ts` | Orchestrates: parallel search (Serper + RSS + Tavily) → deduplicate by URL/title → filter existing → create signals → chain scoring. |
| `categorize.ts` | Keyword matching on signal title to assign type (Hiring, Funding, etc.). Defaults to "News". |
| `serper.ts` | Google search via Serper API. Returns title + URL + snippet. |
| `rss.ts` | Google News RSS feed parsing. Returns title + URL + date. |
| `tavily.ts` | Tavily search with content extraction. Returns title + URL + snippet. |

## 3. Data model

### Account document (MongoDB)

```
{
  name:                 String (required)     — company name
  type:                 Enum [Customer, Partner, Investor, Ecosystem] (required)
  stage:                Enum [Identified, Researching, Engaged, Pilot Discussion,
                              Active Pilot, Customer/Partner, Churned] (required)
  tier:                 Enum [A, B, C] (required, default: C)
  website:              String                — company website URL
  linkedinUrl:          String                — company LinkedIn URL
  opportunityHypothesis: String (required)    — core thesis for this account
  founderNote:          String                — private context
  nextAction:           String                — what needs to happen next
  nextActionDate:       Date                  — when next action is due
  lastTouchpoint:       Date                  — auto-derived from touchpoints array
  keywords:             [String]              — drive signal enrichment searches
  touchpoints:          [{                    — embedded interaction history
    date:     Date (required),
    note:     String (required),
    outcome:  String (default: "")
  }]
  createdAt:            Date (auto)
  updatedAt:            Date (auto)
}
```

### Signal document (MongoDB)

```
{
  accountId:       ObjectId (indexed, ref: Account)
  type:            Enum [Hiring, Funding, Partnership, Product Launch, Expansion,
                         News, Regulatory Approval, Scale-up Announcement,
                         Meeting, Email, Other]
  source:          Enum [Manual, Serper, RSS, Tavily]
  title:           String (required)       — signal headline
  note:            String                  — user's note
  url:             String                  — link to source
  status:          Enum [Confirmed, Suggested, Dismissed]
  date:            Date (required)
  snippet:         String                  — content preview
  relevanceScore:  Number (1-5)            — AI-calculated
  scoreReason:     String                  — why AI gave this score
  createdAt:       Date (auto)
}
```

### ChatThread document (MongoDB)

```
{
  accountId:   ObjectId (indexed, ref: Account)
  title:       String (required)           — auto-set from first user message
  messages:    [{
    role:      Enum [user, model],
    content:   String,
    sources:   [{ title: String, url: String }]
  }]
  createdAt:   Date (auto)
  updatedAt:   Date (auto)
}
```

## 4. Data inputs / integrations

**Automated signal enrichment (3 sources):**

- **Google News RSS** — broad news coverage via RSS feed parsing
- **Serper API** — Google search results for recent, relevant pages
- **Tavily API** — content-rich search with extracted snippets

**AI services:**

- **Gemini 2.5 Pro** — AI chat assistant with Google Search + URL Context grounding
- **Gemini 2.5 Flash** — batch signal scoring (faster, cheaper for high-volume operations)

**Manual inputs:**

- Account data entered through UI forms
- Touchpoints logged manually with date, note, and outcome
- Manual signals added directly (meetings, emails, custom events)

**No external integrations in V1.** No Gmail, no calendar, no CRM sync.

## 5. Processing flow

### Signal enrichment pipeline

```
User clicks "Refresh Signals" on account detail
  → POST /api/accounts/:id/enrich
  → Parallel search: Serper + RSS + Tavily (account name + keywords)
  → Deduplicate results (by URL, then fuzzy title match)
  → Filter out signals already in DB (by URL or title)
  → Create new signals with status="Suggested"
  → Chain AI scoring (Gemini Flash, batches of 20)
  → Score 1-5 + reason per signal
  → Auto-dismiss signals with score < 2
  → Return counts: newSignals, scored, dismissed
```

### AI chat flow

```
User sends message in AiChat panel
  → POST /api/accounts/:id/chat
  → Load account (with tier, touchpoints, keywords, hypothesis)
  → Load all non-dismissed signals (title, type, url, status, date)
  → Build system prompt (account context + touchpoints + signals + staleness)
  → Gemini 2.5 Pro with systemInstruction + Google Search + URL Context
  → Return { text, sources }
  → Client: cleanCitations → ensureMarkdown → render with ReactMarkdown
  → Auto-save to ChatThread (create thread if none active)
```

## 6. Storage approach

- **Database:** MongoDB Atlas (shared cluster, `strategic-account-tracker` database)
- **ODM:** Mongoose 9.x with schema validation
- **Collections:** `accounts`, `signals`, `chatthreads`
- **Indexes:** `signals.accountId`, `chatthreads.accountId` for fast per-account queries
- **No local storage or caching** for data (UI state only)
- **No file storage.** All data is structured text in MongoDB

## 7. Deployment approach

- **Framework:** Next.js 14 with App Router
- **Environment variables:** `MONGODB_URI`, `GEMINI_API_KEY`, `SERPER_API_KEY`, `TAVILY_API_KEY`
- **Build:** `npm run build` compiles Next.js app
- **Start:** `npm start` runs production server

## 8. Known tradeoffs

| Tradeoff | What we chose | What we gave up | Why |
|----------|--------------|-----------------|-----|
| Embedded touchpoints vs. separate collection | Embedded array on Account | Independent CRUD, pagination | Touchpoints are low-volume and always displayed with account. Simpler queries. |
| Separate Signal collection vs. embedded | Separate collection with index | Simpler single-document reads | Signals are high-volume, need aggregation, and are batch-created by enrichment. |
| Three enrichment sources vs. one | Serper + RSS + Tavily | Simplicity, lower API costs | Each source has different coverage. Together they catch signals any single source would miss. |
| Gemini Pro for chat vs. Flash | Pro (better formatting, analysis) | Lower cost, faster responses | Chat quality directly impacts founder decision-making. Worth the cost difference. |
| No authentication | Open access | Access control | Single-user internal tool. Security-through-obscurity acceptable for V1. |
| Client-side markdown post-processing | Reliable formatting regardless of model | Cleaner architecture | Gemini with grounding tools strips markdown. Post-processing is the practical solution. |
| Full signal context in chat (no limit) | All non-dismissed signals loaded | Token efficiency | Account signal volumes are manageable (~50-100). Full context enables better AI analysis. |
| Tier-based staleness thresholds | A=7d, B=14d, C=30d | Uniform simplicity | Strategic accounts need proportionally more attention. Uniform threshold doesn't capture this. |
