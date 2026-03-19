# Prioritized Backlog + V2 Plan — Strategic Account Tracker

**Product:** Strategic Account Tracker
**Builder:** Vishesh Paliwal
**Date:** 19 March 2026
**Sprint:** Lemnisca Product Development Sprint

---

## What was built (V1 delivery)

The tracker delivers a full strategic account intelligence and operating tool with:

- **Account table** with search, type/stage/tier filtering, sorted by tier then due date
- **Account tiering (A/B/C)** — colored badges for strategic prioritization
- **Focus View** — collapsible daily action surface: overdue actions, new signals, stale accounts
- **KPI cards** — total accounts, active pilots, pending actions, new signals
- **Automated signal enrichment** — 3-source parallel search (Google News RSS, Serper, Tavily)
- **AI signal scoring** — Gemini Flash scores 1-5 with reasons, auto-dismiss < 2
- **Signal timeline** — confirm/dismiss workflow with relevance scores
- **Touchpoint timeline** — interaction history with date, note, outcome
- **AI chat assistant** — Gemini Pro with Google Search grounding, persistent threads, structured response modes
- **Keyword-driven enrichment** — customizable signal discovery per account

---

## P0 — Critical Fixes (immediate)

- [ ] **Loading / error states:** Show spinner on initial load and error toast on API failures instead of blank/broken state.
- [ ] **Empty state UX:** When zero accounts exist, show a clear "Add your first strategic account" call-to-action instead of empty table.
- [ ] **Mobile responsive table:** Account table and Focus View should be usable on tablet-sized screens at minimum.
- [ ] **Chat thread deletion:** Allow deleting old chat threads from the thread list (backend route exists, UI button missing).

---

## P1 — High-Impact Next Features

### 1. Scheduled Signal Enrichment
**What:** Auto-enrich all accounts on a daily or configurable schedule, instead of requiring manual "Refresh Signals" clicks per account.
**Why:** The biggest value of the tracker is surfacing signals the founder would miss. Manual enrichment defeats this purpose — signals arrive only when the founder remembers to check.
**Effort:** Medium — cron job or Next.js scheduled function, batch enrichment across all accounts, notification of new high-relevance signals.

### 2. Signal-Driven Notifications
**What:** When a high-relevance signal (score 4-5) is discovered during enrichment, surface it prominently — either as a toast notification, a badge on the dashboard, or a daily email digest.
**Why:** High-relevance signals are time-sensitive. A funding round or key hire should trigger immediate attention, not wait until the founder checks the dashboard.
**Effort:** Small-medium — trigger on signal creation, email via SendGrid or Resend, or push notification.

### 3. Account Comparison View
**What:** Side-by-side comparison of 2-3 accounts showing their signals, stages, touchpoints, and opportunity hypotheses. Useful for deciding which account to prioritize.
**Why:** When multiple accounts compete for attention, the founder needs a quick way to compare their strategic value and engagement status.
**Effort:** Small — new component, reuses existing data.

### 4. CSV Import / Export
**What:** Import accounts from a CSV or spreadsheet. Export the full account table with signals and touchpoints for sharing with advisors.
**Why:** Import eliminates cold-start friction. Export enables sharing pipeline status with co-founders or advisors.
**Effort:** Small-medium — file upload UI, CSV parser, field mapping, batch create.

### 5. Basic Authentication
**What:** Simple password gate or magic link for the deployed URL.
**Why:** Prevents unauthorized access to strategic account data.
**Effort:** Small — Next.js middleware + environment variable for password, or NextAuth with magic link.

### 6. AI Chat Actions
**What:** Allow the AI chat to take actions — confirm/dismiss a signal, add a touchpoint, update next action — directly from the conversation. The chat suggests an action with a confirmation button, and the user approves with one click.
**Why:** Reduces context switching between chat and the UI. The AI already has full context to recommend actions — letting it execute them closes the loop.
**Effort:** Medium — function calling in Gemini, action confirmation UI, API integration.

---

## P2 — Future Ideas (Post-V2)

- [ ] **Relationship graph:** Visual map of connections between accounts (e.g., Novozymes acquired Chr. Hansen → related accounts).
- [ ] **Competitive intelligence:** Track competitor accounts alongside strategic accounts. Surface signals about competitors to inform strategy.
- [ ] **Multi-account enrichment dashboard:** See all new signals across all accounts in one view, not per-account.
- [ ] **Custom signal scoring criteria:** Let the founder define what makes a signal relevant (e.g., "anything about CDMO expansion in Asia is high-relevance").
- [ ] **Email integration (read-only):** Surface recent emails with an account's domain in the detail panel. Requires OAuth.
- [ ] **Calendar integration:** Show upcoming meetings with account contacts in the Focus View.
- [ ] **Mobile-optimized view:** Simplified card list for mobile with swipe-to-act.
- [ ] **Multi-user support:** Team access with roles (viewer, editor). Useful when Lemnisca grows beyond a single founder.
- [ ] **Slack integration:** Post high-relevance signals to a Slack channel for team awareness.
- [ ] **Custom enrichment sources:** Add RSS feeds or custom search queries per account beyond the default three sources.

---

## Recommended Next Build Direction

If given another 3-day sprint, focus on **P1 items 1-2 + 5**: scheduled enrichment, signal notifications, and basic auth. Together these transform the tracker from a "tool you check" into a "tool that tells you" — signals arrive automatically, high-priority ones notify you, and the data is protected.

Priority order:
1. **Scheduled enrichment** (day 1) — the single highest-value feature; makes the tracker proactive instead of reactive
2. **Signal notifications** (day 1-2) — surfaces time-sensitive signals immediately
3. **Basic auth** (day 2, half-day) — secures the deployed URL
4. **AI chat actions** (day 2-3) — closes the loop between AI recommendations and execution
5. **CSV import/export** (day 3) — enables onboarding existing account data
