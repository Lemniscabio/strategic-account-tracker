# Strategic Account Tracker — Design Spec

## Overview

A focused founder-level account tracker for Lemnisca Bio that helps Pushkar systematically track high-value customer, partner, investor, and ecosystem accounts. Combines structured tracking with signal enrichment from public sources (Serper.dev + Google News RSS) to surface timely intelligence and drive disciplined BD and partnership outreach.

**Lemnisca context:** AI-driven biomanufacturing platform — digital twins and adaptive AI for fermentation scale-up. Target accounts are biomanufacturing facilities, biotech partners, deep-tech VCs, and ecosystem players.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Database:** MongoDB via Mongoose ODM — dedicated database (`strategic-account-tracker`) on an existing shared Atlas cluster
- **Signal enrichment:** Serper.dev API (free tier, no credit card) + Google News RSS
- **Deployment:** Vercel + existing MongoDB Atlas cluster
- **Auth:** None (single-user founder tool)

### Environment Variables

| Variable         | Description                              |
|------------------|------------------------------------------|
| `MONGODB_URI`    | Connection string to existing Atlas cluster |
| `SERPER_API_KEY` | Serper.dev API key (free tier)           |

## Data Model

### Account Collection (`accounts`)

| Field                  | Type     | Required | Description                                    |
|------------------------|----------|----------|------------------------------------------------|
| `_id`                  | ObjectId | auto     | MongoDB auto-generated                         |
| `name`                 | string   | yes      | Company name                                   |
| `type`                 | enum     | yes      | `Customer`, `Partner`, `Investor`, `Ecosystem`  |
| `stage`                | enum     | yes      | See Stage Definitions below                    |
| `website`              | string   | no       | Company URL (used for enrichment)              |
| `linkedinUrl`          | string   | no       | Company LinkedIn URL                           |
| `opportunityHypothesis`| string   | yes      | Why this account matters to Lemnisca           |
| `founderNote`          | string   | no       | Pushkar's personal relevance note              |
| `nextAction`           | string   | no       | What to do next                                |
| `nextActionDate`       | Date     | no       | When to do it                                  |
| `lastTouchpoint`       | Date     | no       | Auto-updated from signals or manual            |
| `createdAt`            | Date     | auto     | Mongoose timestamp                             |
| `updatedAt`            | Date     | auto     | Mongoose timestamp                             |

### Signal Collection (`signals`)

| Field       | Type     | Required | Description                                                |
|-------------|----------|----------|------------------------------------------------------------|
| `_id`       | ObjectId | auto     | MongoDB auto-generated                                     |
| `accountId` | ObjectId | yes      | Reference to Account                                       |
| `type`      | enum     | yes      | `Hiring`, `Funding`, `Partnership`, `Product Launch`, `Expansion`, `News`, `Regulatory Approval`, `Scale-up Announcement`, `Meeting`, `Email`, `Other` |
| `source`    | enum     | yes      | `Manual`, `Serper`, `RSS`                                  |
| `title`     | string   | yes      | Signal headline                                            |
| `note`      | string   | no       | Additional context                                         |
| `url`       | string   | no       | Source link                                                |
| `status`    | enum     | yes      | `Confirmed`, `Suggested`, `Dismissed`                      |
| `date`      | Date     | yes      | When the signal occurred                                   |
| `createdAt` | Date     | auto     | Mongoose timestamp                                         |

**Signal behavior:**
- Manual signals are created with `status: Confirmed`
- Enrichment signals (Serper/RSS) are created with `status: Suggested`
- Pushkar confirms or dismisses suggested signals
- The latest confirmed signal per account feeds the "Latest Signal" column in the dashboard table
- Confirming a signal with a touchpoint-type (Meeting, Email) auto-updates `lastTouchpoint` on the account

### Stage Definitions

| Stage             | Meaning                              |
|-------------------|--------------------------------------|
| `Identified`      | On the radar                         |
| `Researching`     | Learning about them                  |
| `Engaged`         | Had a conversation                   |
| `Pilot Discussion`| Talking about a pilot/POC            |
| `Active Pilot`    | Running a pilot                      |
| `Customer/Partner`| Live relationship                    |
| `Churned`         | Went cold                            |

Stages are flexible labels — not all stages apply to all account types. An Investor may go from Identified → Engaged → Customer/Partner without passing through Pilot stages. No stage validation per type.

## Pages & Navigation

| Page             | Route              | Purpose                                              |
|------------------|--------------------|------------------------------------------------------|
| Dashboard        | `/`                | KPI cards + account table with filters/search        |
| Account Detail   | `/accounts/[id]`   | Two-column: info left, signal timeline right         |
| Add/Edit Account | Modal              | Form overlay on dashboard or detail page             |
| Add Signal       | Modal              | Manual signal entry form on detail page              |

No sidebar navigation. App header contains title + "Add Account" button. Minimal chrome.

## Dashboard Layout

**KPI Summary Cards** (top row):
- Total Accounts
- Active Pilots (accounts in `Active Pilot` stage)
- Pending Actions (accounts with `nextAction` set)
- New Signals (signals with `status: Suggested` not yet reviewed)

**Filters** (below KPI cards):
- Search bar (searches account name)
- Stage dropdown filter
- Type dropdown filter

**Account Table** (main content):
Columns: Account Name, Type (badge), Stage (badge), Latest Signal, Next Action. Rows are clickable — navigate to account detail page. Default sort: `nextActionDate` ascending (most urgent first), accounts without a next action date sorted to the bottom.

## Account Detail Layout

**Two-column layout:**

**Left column — Account Context:**
- Opportunity Hypothesis (text block)
- Founder Note (text block)
- Next Action + due date
- Last Touchpoint date
- Website / LinkedIn links

**Right column — Signal Timeline:**
- Chronological list of signals (newest first)
- Each signal shows: date, title, type, source
- Suggested signals have Confirm/Dismiss buttons
- "Add Signal" button at top for manual entry
- "Refresh Signals" button to trigger enrichment

## Signal Enrichment Flow

Triggered on-demand via "Refresh Signals" button (per-account or global).

1. API route receives account `name` + `website`
2. **Serper search:** queries `"{company name}" news OR announcement OR funding OR hiring` — takes top 5 results
3. **Google News RSS:** fetches `news.google.com/rss/search?q={company name}` — parses XML, takes top 5 results
4. **Dedup:** merge results, deduplicate by exact URL match. For title-based dedup, normalize to lowercase and check substring containment. No fuzzy matching for MVP.
5. **Save:** store as signals with `status: Suggested`, `source: Serper|RSS`
6. **Auto-categorize** signal type via keyword matching in title:
   - `Hiring` — hired, hiring, job, recruit, appoint
   - `Funding` — raised, funding, series, round, investment, capital
   - `Partnership` — partner, partnership, collaborate, alliance, joint
   - `Expansion` — expand, facility, new site, scale, capacity
   - `Product Launch` — launch, release, announce product, unveil
   - `Regulatory Approval` — FDA, EMA, approved, clearance, regulatory
   - `Scale-up Announcement` — scale-up, scale up, production ramp
   - Default to `News` if no keywords match
7. Pushkar reviews suggested signals in the timeline — confirms or dismisses

No background scheduling for MVP. Purely on-demand.

## API Routes

| Method | Route                          | Purpose                          |
|--------|--------------------------------|----------------------------------|
| GET    | `/api/accounts`                | List all accounts (with filters) |
| POST   | `/api/accounts`                | Create account                   |
| GET    | `/api/accounts/[id]`           | Get account with latest signal   |
| PUT    | `/api/accounts/[id]`           | Update account                   |
| DELETE | `/api/accounts/[id]`           | Delete account                   |
| GET    | `/api/accounts/[id]/signals`   | List signals for account         |
| POST   | `/api/accounts/[id]/signals`   | Add manual signal                |
| PUT    | `/api/signals/[id]`            | Update signal (confirm/dismiss)  |
| DELETE | `/api/signals/[id]`            | Delete signal                    |
| POST   | `/api/accounts/[id]/enrich`    | Trigger signal enrichment        |
| POST   | `/api/enrich`                  | Global enrichment (all accounts) |
| GET    | `/api/dashboard/stats`         | KPI card data                    |

## Error Handling

- Serper API failures: fail silently, show "Enrichment unavailable" toast, continue with RSS-only results
- RSS fetch failures: fail silently, show toast
- MongoDB connection failures: show error state on page
- Empty states: "No accounts yet — add your first strategic account" / "No signals yet"

## Non-Goals (explicit)

- No auth/login system
- No multi-user support
- No automated scheduled enrichment
- No contact/org mapping within accounts
- No email/outreach integration
- No advanced scoring or ranking
- No bulk import/export
- No mobile-specific responsive design (desktop-first)

## Demo Seed Data

Pre-seed with ~5 realistic biomanufacturing accounts for demo purposes:
- Ginkgo Bioworks (Customer, Pilot Discussion)
- Novozymes (Partner, Engaged)
- Culture Biosciences (Customer, Researching)
- PointOne Capital (Investor, Engaged)
- SynBioBeta (Ecosystem, Engaged)
