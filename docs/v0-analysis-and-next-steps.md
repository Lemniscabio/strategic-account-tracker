# Strategic Account Tracker — V0 Analysis, Doc Requirements & Improvement Plan

*Generated: 18 March 2026*

---

## Part 1: Documents You Need to Prepare (Per Sprint Operating Pack)

The Lemnisca Sprint Operating Pack defines **9 required deliverables** across three phases. Here's exactly what's needed for Strategic Account Tracker, with status:

### A. Core Build-Phase Deliverables (Due by Wednesday night)

| # | Document | File Name | Status | What It Must Contain |
|---|----------|-----------|--------|---------------------|
| 1 | **Product Intake Doc** | `product_intake.md` | ❌ Not created | Target user (Pushkar), current workflow (memory + emails + LinkedIn), pain points, business/founder relevance, constraints, initial assumptions |
| 2 | **PRD-lite** | `prd_lite.md` | ❌ Not created | Product problem statement, why now, core use case, MVP scope, non-goals, acceptance criteria, key decisions/assumptions |
| 3 | **Solution Design Doc** | `solution_design.md` | ⚠️ Partially exists (as `docs/superpowers/specs/...`) | App structure/architecture, major components, data inputs/integrations, processing flow, storage approach, deployment approach, known tradeoffs |

### B. Wednesday Night Submission Deliverables

| # | Document | Status | What It Must Contain |
|---|----------|--------|---------------------|
| 4 | **Deployed MVP** | ⚠️ Built but needs deployment | Must be working and demo-able |
| 5 | **Live URL** | ❌ Not deployed | Must be accessible for demo (Vercel/Railway recommended) |
| 6 | **Repo link** | ⚠️ Needs push to company GitHub | Must be on company GitHub org |
| 7 | **Short README / handoff note** | ❌ Not created | `readme.md` — what the product does, how to run/access it, any credentials or setup notes, major limitations |

### C. Post-Demo Deliverables (Due by Monday, 23 March)

| # | Document | File Name | Status | What It Must Contain |
|---|----------|-----------|--------|---------------------|
| 8 | **UAT / Feedback Notes** | `uat_feedback.md` | ❌ Not created yet (post-demo) | What was demoed, what worked well, gaps identified, feedback received, unresolved issues |
| 9 | **Prioritized Backlog + V2 Plan** | `backlog_v2_plan.md` | ❌ Not created yet (post-demo) | P0 fixes, P1 improvements, P2 future ideas, recommended next build direction |

### Document Naming Convention (from the pack)
All docs should go in one folder per product, named clearly:
- `product_intake.md`
- `prd_lite.md`
- `solution_design.md`
- `readme.md`
- `uat_feedback.md`
- `backlog_v2_plan.md`

---

## Part 2: What Good Founders Use for Strategic Account Tracking

### The Spectrum of Tools Founders Actually Use

**1. Spreadsheets (Most Common Starting Point)**
The vast majority of early-stage founders start with Google Sheets or Airtable. They track 10-30 accounts with columns for company name, type, stage, last touchpoint, next action, and notes. This works until the sheet becomes stale because it lives outside the daily workflow.

**2. Modern Lightweight CRMs**
- **Attio** — The most relevant comp. Built for startups/investors, it offers flexible data modeling, relationship-centric tracking, and doesn't force a rigid sales pipeline. Especially good for mixed relationship types (investors, partners, customers) which is exactly your use case.
- **Streak** — CRM that lives inside Gmail. Zero context-switching. Great for founders who track accounts primarily through email threads.
- **Folk** — Lightweight relationship CRM popular with European founders. Focuses on contact management with simple tagging and pipeline views.
- **Copper** — Google Workspace native. Auto-syncs Gmail and Calendar. Good if Lemnisca is a Google shop.

**3. Notion-Based Setups**
Many disciplined founders build custom account trackers in Notion databases with relations between accounts, signals, touchpoints, and notes. The advantage is everything (decisions, meeting notes, account context) lives in one workspace. The disadvantage is it requires discipline to maintain.

**4. Enterprise Tools (Overkill for Your Stage)**
HubSpot, Salesforce, Pipedrive — these are built for sales teams, not for a single founder tracking 15-30 strategic accounts. They add complexity without proportional value at your stage.

### What the Best Founders Actually Track Per Account

Based on research into B2B account planning best practices:

1. **Account identity**: Name, type (customer/partner/investor/ecosystem), website
2. **Relationship stage**: Where you are in the relationship lifecycle
3. **Opportunity hypothesis**: Why this account matters strategically — the single most important field
4. **Stakeholder map**: Key people and their roles/influence (not just the company)
5. **Last touchpoint + next action**: The operational heartbeat of the tracker
6. **Open questions / objections**: What's unresolved
7. **Signals / intel**: Recent news, hires, funding that create timing windows
8. **Relevance score or tier**: Not every account deserves equal attention — tiering (A/B/C) forces prioritization

### Key Insight from the Research
The tools that founders actually stick with share three traits: they're low-friction to update (< 30 seconds per entry), they surface "what should I do today" without requiring analysis, and they don't try to replace the founder's judgment — they support it.

---

## Part 3: What Your V0 Has Built (Current State)

### Architecture
- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- MongoDB (Atlas) via Mongoose
- Serper.dev API + Google News RSS for signal enrichment

### Features Implemented
- ✅ Full account CRUD (create, list, read, update, delete)
- ✅ Signal CRUD with manual entry
- ✅ Dashboard with 4 KPI cards (total accounts, active pilots, pending actions, new signals)
- ✅ Filterable account table (search, type, stage)
- ✅ Account detail page with two-column layout
- ✅ Signal timeline with confirm/dismiss workflow for suggested signals
- ✅ On-demand enrichment via Serper + RSS
- ✅ Auto-categorization of signals (keyword-based)
- ✅ Auto-update of lastTouchpoint on Meeting/Email signals
- ✅ Demo seed data (5 biomanufacturing accounts)
- ✅ Dark theme UI
- ✅ Toast notifications

### Data Model
- **Accounts**: name, type (4 types), stage (7 stages), website, LinkedIn, opportunityHypothesis, founderNote, nextAction, nextActionDate, lastTouchpoint
- **Signals**: accountId, type (11 types), source (Manual/Serper/RSS), title, note, url, status (Confirmed/Suggested/Dismissed), date

---

## Part 4: Essential Improvements After V0

### Priority 0 — Must-Do for Wednesday Submission

These are non-negotiable for the sprint deadline:

**P0.1 — Deploy to Vercel/Railway**
The operating pack requires a live URL. This is a hard submission requirement. Vercel is the path of least resistance for Next.js.

**P0.2 — Create the missing docs**
You need `product_intake.md`, `prd_lite.md`, and `solution_design.md` (properly formatted, not the superpowers spec). Plus a `readme.md` with setup instructions. These are evaluated as heavily as the product itself.

**P0.3 — Push to company GitHub**
Another hard requirement. Ensure `.env.local` is in `.gitignore` (it is) and repo is clean.

### Priority 1 — High-Impact Product Improvements

**P1.1 — Add a "Today's Actions" or Focus View**
Right now the dashboard shows all accounts equally. The single highest-value improvement would be a filtered view showing "accounts where nextActionDate is today or overdue." This turns the tracker from a database into a daily operating tool — which is what the starter doc means by "compact decision support."

**P1.2 — Add Contact/Stakeholder Tracking Per Account**
Your data model tracks companies but not people. In strategic account management, the relationship is with specific humans. Even a simple list of key contacts (name, role, email) per account would make the tool dramatically more useful for meeting prep and follow-ups.

**P1.3 — Improve the "Next Action" UX**
Next action is currently a free-text field with a date. Better: make it feel like a task — with a "complete" action that auto-logs it as a signal and prompts for the next action. This creates a natural touchpoint loop.

**P1.4 — Add an Account Timeline / Activity Log**
Signals cover external intelligence, but there's no way to log internal activities — "sent intro email," "had coffee meeting," "shared deck." A combined timeline of signals + activities would give Pushkar a full picture of each relationship.

**P1.5 — Account Tiering / Priority Ranking**
Not all accounts are equal. Adding a simple A/B/C tier (or "High/Medium/Low priority") would let the dashboard sort by what matters most. The starter doc explicitly says to "keep the tracked account set intentionally small" — tiering helps enforce this discipline.

### Priority 2 — Nice-to-Have for V2

**P2.1 — Bulk Import/Export (CSV)**
For initial setup and data portability. Many founders have existing account lists in spreadsheets.

**P2.2 — Scheduled Enrichment**
Currently enrichment is manual (click a button per account). A daily or weekly background job that auto-enriches all accounts would keep signals fresh without founder effort.

**P2.3 — Email Integration (Gmail Link)**
Even lightweight — "link a Gmail thread to this account" via URL — would connect the tracker to the actual communication flow.

**P2.4 — Simple Reporting / Relationship Health Dashboard**
A view showing: accounts not touched in 30+ days, accounts with no next action set, accounts in early stages with stale signals. This is the "early warning system" that B2B account management best practices emphasize.

**P2.5 — Mobile-Responsive Design**
The current UI is desktop-only. Founders often check their trackers on mobile between meetings.

**P2.6 — Relationship Map / Org Chart View**
A visual showing how accounts connect (e.g., an investor who also introduced a partner). This becomes valuable as the tracked set grows beyond 15-20 accounts.

### What NOT to Build (Respecting Scope Guardrails)

The starter doc is explicit about these non-goals:
- ❌ No broad sales CRM
- ❌ No deep contact/org mapping
- ❌ No automated outreach engine
- ❌ No advanced account scoring model
- ❌ No full account intelligence platform

The product is strongest when it combines **structured tracking with compact decision support**. Avoid turning it into a generic spreadsheet clone with too many fields.

---

## Summary: Your Immediate Action Items for Tonight

1. **Create `product_intake.md`** — 30 min. Pull from the starter doc's sections 2-6 and add your own understanding.
2. **Create `prd_lite.md`** — 45 min. Define the problem statement, MVP scope, non-goals, and acceptance criteria clearly.
3. **Create `solution_design.md`** — 30 min. Restructure the existing superpowers spec into the expected format.
4. **Create `readme.md`** — 15 min. Setup instructions, env vars needed, how to run, known limitations.
5. **Deploy to Vercel** — 30 min. Connect repo, add env vars, deploy.
6. **Push to company GitHub** — 15 min.
7. **(Stretch) Add the "Today's Actions" focus view** — 1 hour. This single feature will make the demo significantly more compelling because it shows you understand the founder's daily workflow, not just data storage.
