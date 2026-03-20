# Strategic Account Tracker

A founder operating tool for managing strategic accounts in the biomanufacturing and CDMO ecosystem. Combines AI-powered signal intelligence, automated enrichment, touchpoint tracking, account tiering, and a daily focus view into one compact surface.

---

## What this product does

The Strategic Account Tracker replaces scattered Google searches, industry alerts, and memory with a single intelligence and operating view for managing strategic accounts. It automatically discovers relevant signals from multiple sources, scores them for relevance using AI, tracks interaction history, and surfaces what needs attention today.

**Core capabilities:**

- **Account table** with search, filtering by type/stage/tier, sorted by tier then due date
- **Account tiering (A/B/C)** — colored badges for strategic prioritization (green=A, blue=B, gray=C)
- **7-stage pipeline** — Identified, Researching, Engaged, Pilot Discussion, Active Pilot, Customer/Partner, Churned
- **Focus View** — collapsible dashboard section showing overdue actions, new signals, and stale accounts with tier-based thresholds
- **KPI cards** — total accounts, active pilots, pending actions, new signals at a glance
- **Automated signal enrichment** — searches Google News, Serper, and Tavily for relevant signals matching account name + keywords
- **AI signal scoring** — Gemini 2.5 Flash scores each signal 1-5 for relevance and auto-dismisses low-relevance signals
- **Signal timeline** — full history with confirm/dismiss workflow, relevance scores, and source badges
- **Touchpoint timeline** — per-account interaction history with date, note, and outcome/follow-up
- **AI chat assistant** — Gemini 2.5 Pro with Google Search grounding, structured response modes (briefing, action planning, signal analysis), full account context, and persistent chat threads
- **Keyword-driven enrichment** — add keywords to refine automated signal discovery

## How to run locally

### Prerequisites

- Node.js 18+
- MongoDB (local instance or MongoDB Atlas connection string)
- API keys: Gemini, Serper, Tavily

### Setup

```bash
# Clone the repo
git clone <repo-url>
cd strategic-account-tracker

# Install dependencies
npm install

# Create .env.local
cat > .env.local << 'EOF'
MONGODB_URI=mongodb+srv://<your-atlas-connection-string>
GEMINI_API_KEY=<your-gemini-api-key>
SERPER_API_KEY=<your-serper-api-key>
TAVILY_API_KEY=<your-tavily-api-key>
EOF

# Run in development mode
npm run dev
```

Open `http://localhost:3000` in your browser.

### Production build

```bash
npm run build
npm start
```

## Credentials / setup notes

- **MongoDB Atlas:** Connection string stored in `.env.local` as `MONGODB_URI`. Uses shared Atlas cluster with other Lemnisca tools.
- **Gemini API:** Required for AI chat (2.5 Pro) and signal scoring (2.5 Flash).
- **Serper API:** Required for Google search-based signal enrichment.
- **Tavily API:** Required for content-rich signal enrichment with snippets.
- **No authentication:** Single-user internal founder tool. No login required.

## Tech stack

- **Frontend:** React 18, TypeScript, Next.js 14 (App Router), Tailwind CSS 3, React Markdown, @tailwindcss/typography
- **Backend:** Next.js API Routes, Mongoose 9, MongoDB Atlas
- **AI:** Google Gemini 2.5 Pro (chat), Gemini 2.5 Flash (scoring), Google Search + URL Context grounding
- **Enrichment:** Serper API, Google News RSS, Tavily API

## Major limitations

1. **No authentication or access control.** Accessible to anyone with the URL. Acceptable for internal use.
2. **Manual touchpoint entry only.** No email or calendar integration. Touchpoints must be logged by hand.
3. **Signal enrichment depends on API keys.** Without Serper and Tavily keys, only Google News RSS works.
4. **No mobile optimization.** Functional on desktop browsers. Some components may not render well on small screens.
5. **AI formatting depends on post-processing.** Gemini with grounding tools strips markdown syntax. Client-side `ensureMarkdown()` compensates but may not catch all cases.
6. **No multi-user support.** Single founder tool. No collaboration, no shared access, no permissions.
7. **Free-tier MongoDB Atlas.** Shared cluster with storage limits. Sufficient for current usage.
8. **Chat context grows with signals.** All non-dismissed signals are loaded into chat context. Accounts with 500+ signals may hit token limits.
