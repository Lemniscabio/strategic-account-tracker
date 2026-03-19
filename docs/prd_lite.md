# PRD-Lite — Strategic Account Tracker

**Product:** Strategic Account Tracker
**Builder:** Vishesh Paliwal
**Date:** 19 March 2026
**Sprint:** Lemnisca Product Development Sprint

---

## 1. Product problem statement

Pushkar manages 10-20+ strategic accounts across the biomanufacturing and CDMO ecosystem — potential customers, partners, investors, and ecosystem players. Today, account intelligence is scattered across Google searches, email threads, industry news sites, and memory. There is no single surface that monitors these accounts for relevant signals, assesses their strategic importance, tracks interaction history, or surfaces what needs attention today. This leads to missed signals, forgotten follow-ups, and lost business development momentum with high-value accounts.

## 2. Why now

Lemnisca Bio is actively building its strategic network in the biomanufacturing space. The number of accounts to track is growing. Every week without a structured intelligence and tracking system increases the risk of missing a critical signal — a funding round that changes a partner's priorities, a hiring push that signals expansion, a regulatory approval that opens a new market. The cost of building this tool (3-5 days) is far lower than the cost of missing a single strategic partnership opportunity.

## 3. Core use case

Pushkar opens the tracker once or twice daily. In under 60 seconds, he can see:

- The **Focus View** showing overdue actions, new unreviewed signals, and stale accounts — sorted by tier
- **KPI cards** showing total accounts, active pilots, pending actions, and new signals at a glance
- All active accounts with their **tier (A/B/C)**, stage, latest signal, and next action
- Which accounts need **immediate attention** based on tier-specific staleness thresholds

He can then click into any account to:

- Review the **opportunity hypothesis** and founder notes
- See the full **signal timeline** — AI-scored, enriched from Google News, Serper, and Tavily
- Review the **touchpoint timeline** — interaction history with dates, notes, and outcomes
- Open the **AI assistant** for a 30-second briefing, action recommendations, or signal analysis
- Manage **keywords** that drive automated signal discovery
- Manually add signals or touchpoints

## 4. MVP scope

### Included (built and deployed)

**Core account management:**
- **Account table** with search, type/stage/tier filters, sorted by tier then due date
- **Account tiering (A/B/C)** — manual assignment with colored badges (A=green, B=blue, C=gray)
- **7-stage pipeline** — Identified, Researching, Engaged, Pilot Discussion, Active Pilot, Customer/Partner, Churned
- **4 account types** — Customer, Partner, Investor, Ecosystem
- **Opportunity hypothesis** — core thesis for each account
- **Founder notes** — private context for each account
- **Keywords** — drive automated signal enrichment
- **Account CRUD** — create, edit, delete via modal forms

**Signal intelligence:**
- **Automated enrichment** — searches Google News (RSS), Serper, and Tavily for signals matching account name + keywords
- **AI signal scoring** — Gemini 2.5 Flash scores each signal 1-5 for relevance to the account's opportunity hypothesis; auto-dismisses score < 2
- **Signal timeline** — full history of confirmed and suggested signals with relevance scores, source badges, and action buttons
- **Manual signal entry** — add signals directly with type, date, title, URL, and notes
- **11 signal types** — Hiring, Funding, Partnership, Product Launch, Expansion, News, Regulatory Approval, Scale-up Announcement, Meeting, Email, Other

**Touchpoint tracking:**
- **Touchpoint timeline** — embedded per-account history with date, note, and outcome/follow-up
- **Auto-initial touchpoint** — "Started tracking" created automatically on account creation
- **Last touchpoint** — auto-derived from most recent touchpoint date

**Daily operating surface:**
- **Focus View** — collapsible dashboard section with three columns:
  - Overdue Actions (next action due date passed)
  - New Signals (unreviewed suggested signals)
  - Stale Accounts (no touchpoint within tier threshold: A=7d, B=14d, C=30d)
- **KPI cards** — total accounts, active pilots, pending actions, new signals

**AI assistant:**
- **Per-account chat** with Gemini 2.5 Pro + Google Search + URL Context grounding
- **Persistent chat threads** — multiple conversations per account, auto-saved
- **Structured response modes** — briefing, action planning, signal analysis, keyword suggestions
- **Full context** — all non-dismissed signals, touchpoint history, tier/staleness status injected into prompt
- **Keyword auto-add** — AI-suggested keywords can be added with one click

### Not included (explicit non-goals)

- **No full CRM** — this tracks strategic accounts, not individual contacts or leads
- **No email integration** — no Gmail API, no automated email tracking
- **No marketing automation** — no drip campaigns, no outreach sequences
- **No multi-user collaboration** — single founder tool, no auth, no team features
- **No financial modeling** — no deal values, no revenue forecasting, no pipeline weighted value
- **No mobile-native app** — responsive web is sufficient

## 5. Acceptance criteria

The product must:

1. Display accounts in a filterable, sortable table with tier badges and latest signals
2. Show a Focus View with overdue actions, new signals, and stale accounts
3. Support account tiering (A/B/C) with tier-based staleness thresholds
4. Enrich accounts with signals from Google News, Serper, and Tavily
5. AI-score signals for relevance and auto-dismiss low-relevance signals
6. Display a signal timeline per account with confirm/dismiss actions
7. Track touchpoint history per account with date, note, and outcome
8. Provide an AI chat assistant with full account context and persistent threads
9. Auto-surface overdue actions and stale accounts in the Focus View
10. Be demo-able — a reviewer can understand the tool within 30 seconds

## 6. Key decisions and assumptions

| Decision | Rationale |
|----------|-----------|
| Next.js App Router (not separate backend) | Full-stack in one codebase. API routes co-located with pages. Faster development, simpler deployment. |
| MongoDB with Mongoose | Flexible schema for evolving account and signal models. Shared Atlas cluster with other Lemnisca tools. |
| Gemini 2.5 Pro for chat, Flash for scoring | Pro follows formatting instructions and provides better analysis. Flash is faster and cheaper for batch scoring operations. |
| Embedded touchpoints (not separate collection) | Touchpoints are low-volume (a few per account per month) and always displayed with the account. Embedded array is simpler. |
| Separate Signal collection | Signals are high-volume, need complex queries (aggregation, grouping by account), and are created in batches by enrichment. Separate collection scales better. |
| Separate ChatThread collection | Chat messages grow fast and need independent CRUD. Embedded on Account would bloat the document. |
| Tier-based staleness thresholds | A-tier accounts (7d) need more frequent attention than C-tier (30d). Uniform threshold would either over-alert on C-tier or under-alert on A-tier. |
| Post-processing for markdown rendering | Gemini with grounding tools strips markdown syntax. Client-side post-processing ensures consistent formatting regardless of model behavior. |
| No authentication | Single-user internal tool. Auth adds complexity with no user-facing value in V1. |
| Three enrichment sources (RSS, Serper, Tavily) | Each source has different strengths. RSS for broad news, Serper for recent Google results, Tavily for content-rich snippets. Together they provide comprehensive coverage. |
