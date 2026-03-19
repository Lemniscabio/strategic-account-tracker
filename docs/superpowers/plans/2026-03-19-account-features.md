# Account Features Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add account tiering (A/B/C), touchpoint timeline, focus view, and rewrite the AI chat system prompt.

**Architecture:** Additive schema changes to existing Account model (new `tier` field + embedded `touchpoints` array). New Focus View API endpoint + component. System prompt rewrite in existing chat route. All changes follow existing Next.js App Router + Mongoose patterns.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Mongoose/MongoDB, Google Gemini AI

---

## File Map

### Modified Files
- `src/lib/constants.ts` — add ACCOUNT_TIERS constant
- `src/lib/models/account.ts` — add tier field + touchpoints embedded array
- `src/components/AccountForm.tsx` — add tier dropdown
- `src/components/AccountTable.tsx` — add tier column + tier filter state
- `src/components/AccountFilters.tsx` — add tier filter dropdown
- `src/app/api/accounts/route.ts` — tier filter, tier-primary sort, auto-create initial touchpoint on POST
- `src/app/api/accounts/[id]/route.ts` — no changes needed (generic PUT handles new fields)
- `src/app/accounts/[id]/page.tsx` — add touchpoint section + tier badge in header
- `src/app/page.tsx` — add FocusView between KpiCards and AccountTable
- `src/app/api/accounts/[id]/chat/route.ts` — rewrite buildSystemPrompt, load all non-dismissed signals

### New Files
- `src/components/TierBadge.tsx` — tier badge component (A=green, B=blue, C=gray)
- `src/components/TouchpointForm.tsx` — modal form for adding touchpoints
- `src/components/TouchpointTimeline.tsx` — vertical timeline display
- `src/app/api/accounts/[id]/touchpoints/route.ts` — POST to add touchpoint
- `src/components/FocusView.tsx` — collapsible focus section
- `src/app/api/dashboard/focus/route.ts` — focus view API endpoint

---

### Task 1: Add Account Tier to Constants + Model

**Files:**
- Modify: `src/lib/constants.ts:1-37`
- Modify: `src/lib/models/account.ts:1-41`

- [ ] **Step 1: Add ACCOUNT_TIERS constant**

In `src/lib/constants.ts`, add after line 2:

```ts
export const ACCOUNT_TIERS = ['A', 'B', 'C'] as const;
export type AccountTier = (typeof ACCOUNT_TIERS)[number];
```

- [ ] **Step 2: Add tier + touchpoints to Account model**

In `src/lib/models/account.ts`:

Update the import to include `AccountTier` and `ACCOUNT_TIERS`:
```ts
import { ACCOUNT_TYPES, STAGES, ACCOUNT_TIERS, AccountType, Stage, AccountTier } from "../constants";
```

Add to `IAccount` interface (after `stage`):
```ts
  tier: AccountTier;
```

Add (after `keywords`):
```ts
  touchpoints: { date: Date; note: string; outcome: string }[];
```

Add to `AccountSchema` (after `stage` field):
```ts
    tier: { type: String, enum: ACCOUNT_TIERS, required: true, default: "C" },
```

Add (after `keywords` field):
```ts
    touchpoints: {
      type: [
        {
          date: { type: Date, required: true },
          note: { type: String, required: true },
          outcome: { type: String, default: "" },
        },
      ],
      default: [],
    },
```

- [ ] **Step 3: Verify the app compiles**

Run: `npx next build --no-lint 2>&1 | head -20` or `npx tsc --noEmit`
Expected: No type errors related to account model

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts src/lib/models/account.ts
git commit -m "feat: add account tier and touchpoints to schema"
```

---

### Task 2: TierBadge Component

**Files:**
- Create: `src/components/TierBadge.tsx`

- [ ] **Step 1: Create TierBadge component**

```tsx
"use client";

import { AccountTier } from "@/lib/constants";

const TIER_STYLES: Record<AccountTier, string> = {
  A: "bg-emerald-900 text-emerald-300",
  B: "bg-blue-900 text-blue-300",
  C: "bg-gray-700 text-gray-400",
};

export default function TierBadge({ tier }: { tier: AccountTier }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${TIER_STYLES[tier]}`}>
      {tier}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TierBadge.tsx
git commit -m "feat: add TierBadge component"
```

---

### Task 3: Add Tier to Account Form

**Files:**
- Modify: `src/components/AccountForm.tsx:1-130`

- [ ] **Step 1: Update AccountForm**

Add to imports:
```ts
import { ACCOUNT_TYPES, STAGES, ACCOUNT_TIERS } from "@/lib/constants";
```

Add `tier?: string;` to the Props `account?` interface (after `stage`).

Add to form state initialization (after `stage`):
```ts
    tier: account?.tier || "C",
```

Add tier dropdown in the form — change the Type/Stage grid (line 77: `grid-cols-2`) to `grid-cols-3` and add the tier select between Type and Stage. Do NOT change the other `grid-cols-2` divs on lines 99 and 109:
```tsx
<div>
  <label className={labelClass}>Tier *</label>
  <select className={inputClass} value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })}>
    {ACCOUNT_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
  </select>
</div>
```

- [ ] **Step 2: Verify form renders**

Run dev server and check the Add Account form shows the tier dropdown.

- [ ] **Step 3: Commit**

```bash
git add src/components/AccountForm.tsx
git commit -m "feat: add tier select to account form"
```

---

### Task 4: Add Tier Column + Filter to Dashboard Table

**Files:**
- Modify: `src/components/AccountTable.tsx:1-111`
- Modify: `src/components/AccountFilters.tsx:1-42`

- [ ] **Step 1: Update AccountFilters to include tier**

Add `ACCOUNT_TIERS` to the import from constants.

Add `tier: string;` and `onTierChange: (v: string) => void;` to Props interface.

Add `tier` and `onTierChange` to destructured props.

Add a tier select after the existing selects:
```tsx
<select value={tier} onChange={(e) => onTierChange(e.target.value)} className={selectClass}>
  <option value="">All Tiers</option>
  {ACCOUNT_TIERS.map((t) => (
    <option key={t} value={t}>Tier {t}</option>
  ))}
</select>
```

- [ ] **Step 2: Update AccountTable to manage tier state + show tier column**

Add to imports:
```ts
import { AccountType, Stage, AccountTier } from "@/lib/constants";
import TierBadge from "./TierBadge";
```

Add `tier?: AccountTier;` to `AccountRow` interface.

Add tier state:
```ts
const [tier, setTier] = useState("");
```

Add `tier` to useEffect dependencies and params:
```ts
if (tier) params.set("tier", tier);
```
Update dependency array: `[search, type, stage, tier]`

Update AccountFilters usage to pass `tier={tier}` and `onTierChange={setTier}`.

Add Tier column header after Account:
```tsx
<th className="px-4 py-3">Tier</th>
```

Add Tier cell after account name cell:
```tsx
<td className="px-4 py-3">
  <TierBadge tier={account.tier || "C"} />
</td>
```

- [ ] **Step 3: Update API to handle tier filter + sort**

In `src/app/api/accounts/route.ts`:

Add tier filter (after stage filter):
```ts
const tier = searchParams.get("tier");
if (tier) filter.tier = tier;
```

Change Mongo sort to:
```ts
.sort({ tier: 1, nextActionDate: 1 })
```

Update the JS sort to use tier as primary:
```ts
result.sort((a, b) => {
  const tierA = (a.tier || "C") as string;
  const tierB = (b.tier || "C") as string;
  if (tierA !== tierB) return tierA.localeCompare(tierB);
  if (a.nextActionDate && b.nextActionDate) {
    return new Date(a.nextActionDate).getTime() - new Date(b.nextActionDate).getTime();
  }
  if (a.nextActionDate && !b.nextActionDate) return -1;
  if (!a.nextActionDate && b.nextActionDate) return 1;
  return 0;
});
```

- [ ] **Step 4: Commit**

```bash
git add src/components/AccountTable.tsx src/components/AccountFilters.tsx src/app/api/accounts/route.ts
git commit -m "feat: add tier column, filter, and sort to dashboard"
```

---

### Task 5: Auto-Create Initial Touchpoint on Account Creation

**Files:**
- Modify: `src/app/api/accounts/route.ts:53-58`

- [ ] **Step 1: Update POST handler**

Replace the POST handler:
```ts
export async function POST(request: NextRequest) {
  await dbConnect();
  const body = await request.json();

  const now = new Date();
  body.touchpoints = [{ date: now, note: "Started tracking", outcome: "" }];
  body.lastTouchpoint = now;

  const account = await Account.create(body);
  return NextResponse.json(account, { status: 201 });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/accounts/route.ts
git commit -m "feat: auto-create initial touchpoint on account creation"
```

---

### Task 6: Touchpoint API Route

**Files:**
- Create: `src/app/api/accounts/[id]/touchpoints/route.ts`

- [ ] **Step 1: Create touchpoints route**

```ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Account from "@/lib/models/account";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const { date, note, outcome } = await request.json();

  if (!date || !note) {
    return NextResponse.json({ error: "date and note are required" }, { status: 400 });
  }

  const touchpoint = { date: new Date(date), note, outcome: outcome || "" };

  const account = await Account.findByIdAndUpdate(
    id,
    {
      $push: { touchpoints: touchpoint },
    },
    { new: true, runValidators: true }
  ).lean();

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  // Update lastTouchpoint to the most recent touchpoint date
  const maxDate = (account.touchpoints || []).reduce((max: Date, tp: { date: Date }) => {
    const d = new Date(tp.date);
    return d > max ? d : max;
  }, new Date(0));

  await Account.findByIdAndUpdate(id, { lastTouchpoint: maxDate });

  return NextResponse.json({ success: true, touchpoint });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/accounts/[id]/touchpoints/route.ts
git commit -m "feat: add touchpoints API route"
```

---

### Task 7: TouchpointForm + TouchpointTimeline Components

**Files:**
- Create: `src/components/TouchpointForm.tsx`
- Create: `src/components/TouchpointTimeline.tsx`

- [ ] **Step 1: Create TouchpointForm**

```tsx
"use client";

import { useState } from "react";

interface Props {
  accountId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function TouchpointForm({ accountId, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    note: "",
    outcome: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/accounts/${accountId}/touchpoints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) onSaved();
  };

  const inputClass =
    "w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none";
  const labelClass = "block text-xs font-medium text-gray-400 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-gray-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold text-white">Add Touchpoint</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelClass}>Date *</label>
            <input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div>
            <label className={labelClass}>Note *</label>
            <textarea className={inputClass} rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} required placeholder="e.g. Intro call with CTO" />
          </div>
          <div>
            <label className={labelClass}>Outcome / Follow-up</label>
            <textarea className={inputClass} rows={2} value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} placeholder="e.g. Agreed to schedule pilot discussion" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving..." : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create TouchpointTimeline**

```tsx
"use client";

interface Touchpoint {
  date: string;
  note: string;
  outcome: string;
}

interface Props {
  touchpoints: Touchpoint[];
}

export default function TouchpointTimeline({ touchpoints }: Props) {
  const sorted = [...touchpoints].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (sorted.length === 0) {
    return <div className="text-sm text-gray-500">No touchpoints yet</div>;
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-700" />

      {sorted.map((tp, i) => (
        <div key={i} className="relative flex gap-3 pb-4">
          {/* Dot */}
          <div className="relative z-10 mt-1.5 h-[14px] w-[14px] flex-shrink-0 rounded-full border-2 border-blue-500 bg-gray-900" />

          {/* Content */}
          <div className="min-w-0">
            <div className="text-xs font-semibold text-gray-300">
              {new Date(tp.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
            <div className="mt-0.5 text-sm text-gray-400">{tp.note}</div>
            {tp.outcome && (
              <div className="mt-0.5 text-xs text-gray-500 italic">→ {tp.outcome}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/TouchpointForm.tsx src/components/TouchpointTimeline.tsx
git commit -m "feat: add TouchpointForm and TouchpointTimeline components"
```

---

### Task 8: Integrate Touchpoints + Tier into Account Detail Page

**Files:**
- Modify: `src/app/accounts/[id]/page.tsx:1-331`

- [ ] **Step 1: Update Account detail page**

Add imports:
```ts
import TierBadge from "@/components/TierBadge";
import TouchpointForm from "@/components/TouchpointForm";
import TouchpointTimeline from "@/components/TouchpointTimeline";
import { AccountType, Stage, AccountTier } from "@/lib/constants";
```

Add to `Account` interface:
```ts
  tier: AccountTier;
  touchpoints?: { date: string; note: string; outcome: string }[];
```

Add state:
```ts
const [showTouchpointForm, setShowTouchpointForm] = useState(false);
```

Add TierBadge next to TypeBadge and StageBadge in the header badges section (line ~173):
```tsx
<TierBadge tier={account.tier || "C"} />
```

Replace the `grid grid-cols-2` div (lines 233-251) that contains NEXT ACTION and LAST TOUCHPOINT. Keep the grid wrapper but replace the LAST TOUCHPOINT card with touchpoints:

```tsx
<div className="grid grid-cols-2 gap-4">
  <div className="rounded-lg bg-gray-900 p-4">
    <div className="text-xs font-medium text-gray-500">NEXT ACTION</div>
    <div className="mt-2 text-sm text-yellow-400">{account.nextAction || "—"}</div>
    {account.nextActionDate && (
      <div className="mt-1 text-xs text-gray-500">
        Due: {new Date(account.nextActionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
      </div>
    )}
  </div>
  <div className="rounded-lg bg-gray-900 p-4">
    <div className="mb-3 flex items-center justify-between">
      <div className="text-xs font-medium text-gray-500">TOUCHPOINTS</div>
      <button
        onClick={() => setShowTouchpointForm(true)}
        className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
      >
        + Add
      </button>
    </div>
    <TouchpointTimeline touchpoints={account.touchpoints || []} />
  </div>
</div>
```

Add the TouchpointForm modal in the modals section (after SignalForm):
```tsx
{showTouchpointForm && (
  <TouchpointForm
    accountId={id}
    onClose={() => setShowTouchpointForm(false)}
    onSaved={() => { setShowTouchpointForm(false); fetchAccount(); }}
  />
)}
```

- [ ] **Step 2: Verify the page renders with touchpoints**

Run dev server, navigate to an account detail page — confirm tier badge shows, touchpoint section renders.

- [ ] **Step 3: Commit**

```bash
git add src/app/accounts/[id]/page.tsx
git commit -m "feat: integrate tier badge and touchpoint timeline into account detail"
```

---

### Task 9: Focus View API Endpoint

**Files:**
- Create: `src/app/api/dashboard/focus/route.ts`

- [ ] **Step 1: Create focus endpoint**

```ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Account from "@/lib/models/account";
import Signal from "@/lib/models/signal";

const STALE_THRESHOLDS: Record<string, number> = { A: 7, B: 14, C: 30 };

export async function GET() {
  await dbConnect();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 1. Overdue Actions
  const overdueAccounts = await Account.find({
    nextAction: { $exists: true, $ne: "" },
    nextActionDate: { $lte: startOfToday },
  })
    .select("name tier nextAction nextActionDate")
    .sort({ nextActionDate: 1 })
    .lean();

  const overdueActions = overdueAccounts.map((a) => ({
    _id: a._id,
    name: a.name,
    tier: a.tier || "C",
    action: a.nextAction,
    daysOverdue: Math.floor((now.getTime() - new Date(a.nextActionDate!).getTime()) / (1000 * 60 * 60 * 24)),
  }));

  // 2. New Signals (grouped by account)
  const suggestedSignals = await Signal.aggregate([
    { $match: { status: "Suggested" } },
    { $sort: { date: -1 } },
    {
      $group: {
        _id: "$accountId",
        count: { $sum: 1 },
        latestTitle: { $first: "$title" },
      },
    },
    { $sort: { count: -1 } },
  ]);

  const signalAccountIds = suggestedSignals.map((s) => s._id);
  const signalAccounts = await Account.find({ _id: { $in: signalAccountIds } })
    .select("name tier")
    .lean();
  const signalAccountMap = new Map(signalAccounts.map((a) => [a._id.toString(), a]));

  const newSignals = suggestedSignals
    .map((s) => {
      const acct = signalAccountMap.get(s._id.toString());
      if (!acct) return null;
      return {
        _id: acct._id,
        name: acct.name,
        tier: (acct as Record<string, unknown>).tier || "C",
        count: s.count,
        latestTitle: s.latestTitle,
      };
    })
    .filter(Boolean);

  // 3. Stale Accounts
  const allAccounts = await Account.find({
    stage: { $ne: "Churned" },
    lastTouchpoint: { $exists: true },
  })
    .select("name tier lastTouchpoint touchpoints")
    .lean();

  const staleAccounts = allAccounts
    .map((a) => {
      const tier = ((a as Record<string, unknown>).tier as string) || "C";
      const threshold = STALE_THRESHOLDS[tier] || 30;
      const daysSince = Math.floor((now.getTime() - new Date(a.lastTouchpoint!).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince < threshold) return null;

      // Get last touchpoint note
      const touchpoints = (a as Record<string, unknown>).touchpoints as { date: Date; note: string }[] | undefined;
      const lastNote = touchpoints && touchpoints.length > 0
        ? touchpoints.sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())[0].note
        : "No touchpoint recorded";

      return {
        _id: a._id,
        name: a.name,
        tier,
        daysSince,
        lastNote,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const ratioA = a!.daysSince / (STALE_THRESHOLDS[a!.tier] || 30);
      const ratioB = b!.daysSince / (STALE_THRESHOLDS[b!.tier] || 30);
      return ratioB - ratioA;
    });

  return NextResponse.json({
    overdueActions,
    newSignals,
    staleAccounts,
    totalItems: overdueActions.length + newSignals.length + staleAccounts.length,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/dashboard/focus/route.ts
git commit -m "feat: add focus view API endpoint"
```

---

### Task 10: FocusView Component

**Files:**
- Create: `src/components/FocusView.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create FocusView component**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TierBadge from "./TierBadge";
import { AccountTier } from "@/lib/constants";

interface OverdueAction {
  _id: string;
  name: string;
  tier: AccountTier;
  action: string;
  daysOverdue: number;
}

interface NewSignal {
  _id: string;
  name: string;
  tier: AccountTier;
  count: number;
  latestTitle: string;
}

interface StaleAccount {
  _id: string;
  name: string;
  tier: AccountTier;
  daysSince: number;
  lastNote: string;
}

interface FocusData {
  overdueActions: OverdueAction[];
  newSignals: NewSignal[];
  staleAccounts: StaleAccount[];
  totalItems: number;
}

export default function FocusView() {
  const router = useRouter();
  const [data, setData] = useState<FocusData | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/focus")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data || data.totalItems === 0) return null;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">🎯</span>
          <div className="text-left">
            <div className="text-sm font-semibold text-white">Today&apos;s Focus</div>
            <div className="text-xs text-gray-500">{data.totalItems} item{data.totalItems !== 1 ? "s" : ""} need your attention</div>
          </div>
        </div>
        <span className={`text-gray-500 transition-transform ${expanded ? "" : "-rotate-90"}`}>▼</span>
      </button>

      {/* Body */}
      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-5 pb-5">
          {/* Overdue Actions */}
          <div className="rounded-lg border border-gray-800 bg-gray-950 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Overdue Actions
              </div>
              {data.overdueActions.length > 0 && (
                <span className="rounded-full bg-red-900/50 px-2 py-0.5 text-xs font-semibold text-red-400">
                  {data.overdueActions.length}
                </span>
              )}
            </div>
            <div className="p-2">
              {data.overdueActions.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-gray-600">All clear</div>
              ) : (
                data.overdueActions.map((item) => (
                  <div
                    key={item._id}
                    onClick={() => router.push(`/accounts/${item._id}`)}
                    className="cursor-pointer rounded-md px-3 py-2.5 hover:bg-gray-900"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-200">
                        {item.name}
                        <TierBadge tier={item.tier} />
                      </div>
                      <span className="rounded bg-red-900/50 px-2 py-0.5 text-xs font-medium text-red-400">
                        {item.daysOverdue}d overdue
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 truncate">{item.action}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* New Signals */}
          <div className="rounded-lg border border-gray-800 bg-gray-950 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
                <span className="h-2 w-2 rounded-full bg-yellow-500" />
                New Signals
              </div>
              {data.newSignals.length > 0 && (
                <span className="rounded-full bg-yellow-900/50 px-2 py-0.5 text-xs font-semibold text-yellow-400">
                  {data.newSignals.length}
                </span>
              )}
            </div>
            <div className="p-2">
              {data.newSignals.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-gray-600">All clear</div>
              ) : (
                data.newSignals.map((item) => (
                  <div
                    key={item._id}
                    onClick={() => router.push(`/accounts/${item._id}`)}
                    className="cursor-pointer rounded-md px-3 py-2.5 hover:bg-gray-900"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-200">
                        {item.name}
                        <TierBadge tier={item.tier} />
                      </div>
                      <span className="text-xs font-medium text-yellow-400">{item.count} new</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 truncate">Latest: {item.latestTitle}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Stale Accounts */}
          <div className="rounded-lg border border-gray-800 bg-gray-950 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Stale Accounts
              </div>
              {data.staleAccounts.length > 0 && (
                <span className="rounded-full bg-blue-900/50 px-2 py-0.5 text-xs font-semibold text-blue-400">
                  {data.staleAccounts.length}
                </span>
              )}
            </div>
            <div className="p-2">
              {data.staleAccounts.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-gray-600">All clear</div>
              ) : (
                data.staleAccounts.map((item) => (
                  <div
                    key={item._id}
                    onClick={() => router.push(`/accounts/${item._id}`)}
                    className="cursor-pointer rounded-md px-3 py-2.5 hover:bg-gray-900"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-200">
                        {item.name}
                        <TierBadge tier={item.tier} />
                      </div>
                      <span className="rounded bg-blue-900/50 px-2 py-0.5 text-xs font-medium text-blue-400">
                        {item.daysSince}d no touch
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 truncate">Last: {item.lastNote}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add FocusView to dashboard page**

Update `src/app/page.tsx`:
```tsx
import KpiCards from "@/components/KpiCards";
import AccountTable from "@/components/AccountTable";
import FocusView from "@/components/FocusView";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <KpiCards />
      <FocusView />
      <AccountTable />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/FocusView.tsx src/app/page.tsx
git commit -m "feat: add FocusView component to dashboard"
```

---

### Task 11: Rewrite AI Chat System Prompt

**Files:**
- Modify: `src/app/api/accounts/[id]/chat/route.ts:1-80`

- [ ] **Step 1: Rewrite buildSystemPrompt and update signal query**

Replace the entire `buildSystemPrompt` function and update the signal query in the POST handler.

New `buildSystemPrompt`:

```ts
function buildSystemPrompt(account: Record<string, unknown>, signals: Record<string, unknown>[]): string {
  // Build signal list (title + url + status)
  const signalList = signals
    .map((s, i) => {
      const status = s.status === "Suggested" ? " [SUGGESTED]" : "";
      const url = s.url ? ` | ${s.url}` : "";
      return `${i + 1}. ${s.title}${status} (${s.type}, ${new Date(s.date as string).toLocaleDateString()})${url}`;
    })
    .join("\n");

  // Build touchpoint timeline
  const touchpoints = (account.touchpoints as { date: Date; note: string; outcome: string }[]) || [];
  const touchpointList = [...touchpoints]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((tp) => {
      const outcome = tp.outcome ? ` → ${tp.outcome}` : "";
      return `- ${new Date(tp.date).toLocaleDateString()}: ${tp.note}${outcome}`;
    })
    .join("\n");

  // Compute staleness
  const tier = (account.tier as string) || "C";
  const thresholds: Record<string, number> = { A: 7, B: 14, C: 30 };
  const threshold = thresholds[tier] || 30;
  const lastTouchDate = account.lastTouchpoint ? new Date(account.lastTouchpoint as string) : null;
  const daysSinceTouch = lastTouchDate
    ? Math.floor((Date.now() - lastTouchDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const isStale = daysSinceTouch !== null && daysSinceTouch >= threshold;

  const stalenessLine = daysSinceTouch !== null
    ? `Days since last touchpoint: ${daysSinceTouch} (Tier ${tier} threshold: ${threshold} days)${isStale ? " ⚠️ STALE — needs attention" : ""}`
    : "No touchpoints recorded yet";

  return `You are a strategic account intelligence analyst for **Lemniscate**, a biomanufacturing and CDMO-focused investment and advisory firm. You help the founder make faster, better-informed decisions about strategic accounts.

---

## Account Context

- **Company:** ${account.name}
- **Type:** ${account.type} | **Stage:** ${account.stage} | **Tier:** ${tier}
- **Opportunity Hypothesis:** ${account.opportunityHypothesis}
${account.founderNote ? `- **Founder Note:** ${account.founderNote}` : ""}
- **Keywords:** ${(account.keywords as string[])?.length > 0 ? (account.keywords as string[]).join(", ") : "None set"}
- **Next Action:** ${account.nextAction || "None"}${account.nextActionDate ? ` (due: ${new Date(account.nextActionDate as string).toLocaleDateString()})` : ""}
- **${stalenessLine}**

## Touchpoint History
${touchpointList || "No touchpoints recorded"}

## Signals (${signals.length} active)
${signalList || "No signals yet"}

---

## How You Respond

**Always follow these formatting rules:**
- Use **bullet points** for all lists — never paragraphs of comma-separated items
- Use **bold** for company names, key terms, action items, and important dates
- Use **## headers** to organize responses with more than 3 points
- Keep every sentence specific to this account's actual data — no generic filler
- End any actionable response with: **Suggested next step:** [concrete action]

**Response Modes:**

### When asked to "brief me" or give a summary:
- Start with one sentence: tier, stage, and whether the account needs attention
- **Recent activity:** last 2-3 touchpoints + whether stale
- **Top signals:** 3 most relevant with why they matter for the opportunity hypothesis
- **Risk/opportunity:** anything time-sensitive

### When asked "what should I do next" or for action planning:
- Assess current stage and what the natural next milestone is
- Flag any overdue actions or staleness
- Identify signal-driven opportunities (e.g., funding → good time to reach out)
- Recommend **one concrete next action** with a suggested timeline

### When asked about a specific signal:
- Explain why it matters (or doesn't) for the opportunity hypothesis
- Connect it to Lemniscate's biomanufacturing/CDMO investment thesis
- Note implications for stage progression or urgency
- If it's a Suggested signal, recommend whether to confirm or dismiss

### When asked to suggest keywords:
- Analyze current keyword coverage gaps
- Return exactly this JSON in your response: {"suggestedKeywords": ["kw1", "kw2", "kw3"]}
- Explain briefly why each keyword would improve signal discovery

## Constraints
- **NEVER** mention your tools, search process, URLs you visited, or what succeeded/failed
- **NEVER** say "I don't have access to" or "based on the information provided" — just use the data above
- **NEVER** use vague filler like "it's worth monitoring" without saying specifically what to watch for and by when
- If asked something outside this account's context, say so in one sentence and redirect to what you can help with`;
}
```

- [ ] **Step 2: Update signal query in POST handler**

Replace the signal query (remove `.limit(15)` and change sort):

```ts
  const signals = await Signal.find({ accountId: id, status: { $ne: "Dismissed" } })
    .select("title type url status date")
    .sort({ date: -1 })
    .lean();
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/accounts/[id]/chat/route.ts
git commit -m "feat: rewrite AI chat system prompt with structured modes and full context"
```

---

### Task 12: Final Verification + Cleanup

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run dev server and verify all features**

Run: `npm run dev`

Verify:
- Dashboard shows Focus View (expanded) between KPI cards and table
- Account table has Tier column, sorted A→B→C
- Tier filter works
- Creating account shows tier dropdown, defaults to C
- New accounts get "Started tracking" touchpoint
- Account detail shows tier badge, touchpoint timeline
- Adding a touchpoint works
- AI chat responds with formatted bullet points and proper context

- [ ] **Step 3: Delete mockup file**

```bash
rm mockup-focus-view.html
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: remove mockup file, cleanup"
```
