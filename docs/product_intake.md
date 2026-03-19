# Product Intake Doc — Strategic Account Tracker

**Product:** Strategic Account Tracker
**Builder:** Vishesh Paliwal
**Date:** 19 March 2026
**Sprint:** Lemnisca Product Development Sprint

---

## 1. Target user

Pushkar (founder, Lemnisca Bio). Sole user for V1. The tracker is a personal founder operating tool for managing strategic accounts in the biomanufacturing and CDMO ecosystem — potential customers, partners, investors, and ecosystem players.

## 2. Current workflow

Strategic account intelligence is scattered across browser bookmarks, email threads, Google alerts, industry news, and memory. There is no single surface that shows which accounts matter most, what signals have appeared, when the last interaction happened, or what the next action should be.

Typical daily pattern:

- Google a company name to check for recent news or funding
- Try to remember when last contact was made and what was discussed
- Manually search for industry signals across multiple news sources
- Mentally reconstruct which accounts are at which stage
- Occasionally note an opportunity in a doc or Slack message, but not systematically
- Forget to follow up on accounts that showed early promise

There is no structured signal tracking, no AI-powered analysis, no enrichment automation, and no systematic follow-up management.

## 3. Pain points

- **Signal discovery is manual and inconsistent.** Relevant industry signals (funding, hiring, partnerships, regulatory approvals) are missed because there is no automated monitoring. The founder must manually search for news about each account.
- **Account context takes time to reconstruct.** Before each interaction, gathering context about an account — what signals have appeared, what the opportunity hypothesis is, what was discussed last — takes significant time.
- **Follow-ups slip through the cracks.** Without a structured system, time-sensitive actions (send a case study, schedule a pilot discussion, follow up after a conference) get missed or delayed.
- **Signal relevance is hard to assess.** Not all news about a company matters. Without AI scoring, the founder must manually evaluate whether each signal is relevant to Lemnisca's thesis.
- **No strategic prioritization.** Without account tiering and staleness tracking, all accounts are treated equally rather than prioritized by strategic importance.
- **Touchpoint history is invisible.** The record of interactions with each account exists only in email and memory. There is no running log of what was discussed and what the outcomes were.

## 4. Business / founder relevance

Strategic accounts are the core pipeline for Lemnisca Bio's business development. Whether they become customers, partners, or investment targets, each account represents a potential relationship that can materially impact the company's trajectory. Missing a signal — a key hire at a target company, a funding round that changes their priorities, a regulatory approval that opens a new opportunity — means missing a window of opportunity. The cost of poor account management is measured in lost partnerships and delayed business development.

## 5. Constraints

- **Founder bandwidth:** The tool must surface insights and actions proactively, not require the founder to go looking for them. Daily check-in should take under 60 seconds.
- **Data entry:** Must be low-friction. Automated signal enrichment from external sources (Google News, Serper, Tavily) reduces manual data entry burden.
- **Engineering:** Next.js with MongoDB Atlas. Single codebase. No separate backend service.
- **AI costs:** Gemini 2.5 Pro for chat, Gemini 2.5 Flash for signal scoring. Keep token usage efficient by loading only necessary context.
- **Scope:** This is a strategic account operating view with AI intelligence, not a full CRM, not a marketing automation platform, not a contact database.

## 6. Initial assumptions

- A dashboard with KPI cards, focus view, and account table is the right primary UX pattern for daily operations.
- AI-powered signal enrichment and scoring materially reduces the time needed to stay informed about each account.
- Manual data entry is acceptable for account creation and touchpoints if the enrichment pipeline handles signal discovery automatically.
- A 7-stage pipeline (Identified → Researching → Engaged → Pilot Discussion → Active Pilot → Customer/Partner → Churned) covers the full account lifecycle.
- Account tiering (A/B/C) with tier-based staleness thresholds helps the founder focus on what matters most.
- An AI chat assistant that knows the full account context can serve as a real-time briefing and action planning tool.
- MongoDB embedded documents work for touchpoints (low volume per account). Separate collection for signals (high volume, complex queries).

## 7. What this tool does NOT do

- **No full CRM.** This is a strategic account intelligence tool, not a contact management platform. It tracks accounts, not individual contacts.
- **No email integration.** No Gmail API, no automated email tracking. Touchpoints are logged manually.
- **No marketing automation.** No drip campaigns, no mass outreach, no email sequences.
- **No multi-user collaboration.** Single founder tool. No auth, no team features.
- **No financial modeling.** No revenue forecasting, no deal value tracking, no pipeline weighted value.
