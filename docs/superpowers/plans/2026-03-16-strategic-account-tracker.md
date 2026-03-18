# Strategic Account Tracker Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a founder-level strategic account tracker for Lemnisca Bio with signal enrichment from Serper.dev and Google News RSS.

**Architecture:** Next.js 14 App Router monolith with MongoDB (Mongoose) for persistence. Two collections (accounts, signals). Server-side API routes handle CRUD and enrichment. Client components for interactive dashboard and detail views. Tailwind CSS for styling.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, MongoDB/Mongoose, Serper.dev API, Google News RSS

**Spec:** `docs/superpowers/specs/2026-03-16-strategic-account-tracker-design.md`

---

## File Structure

```
strategic-account-tracker/
├── .env.local                          # MONGODB_URI, SERPER_API_KEY
├── .gitignore
├── next.config.js
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.js
├── src/
│   ├── lib/
│   │   ├── mongodb.ts                  # MongoDB connection singleton
│   │   ├── models/
│   │   │   ├── account.ts              # Account Mongoose model + types
│   │   │   └── signal.ts               # Signal Mongoose model + types
│   │   ├── constants.ts                # Enums: account types, stages, signal types
│   │   └── enrichment/
│   │       ├── serper.ts               # Serper.dev API client
│   │       ├── rss.ts                  # Google News RSS parser
│   │       ├── categorize.ts           # Keyword-to-signal-type mapping
│   │       └── enrich.ts               # Orchestrator: fetch, dedup, categorize, save
│   ├── app/
│   │   ├── layout.tsx                  # Root layout with header
│   │   ├── page.tsx                    # Dashboard page
│   │   ├── accounts/
│   │   │   └── [id]/
│   │   │       └── page.tsx            # Account detail page
│   │   └── api/
│   │       ├── accounts/
│   │       │   ├── route.ts            # GET (list+filter), POST (create)
│   │       │   └── [id]/
│   │       │       ├── route.ts        # GET, PUT, DELETE single account
│   │       │       ├── signals/
│   │       │       │   └── route.ts    # GET (list), POST (add manual signal)
│   │       │       └── enrich/
│   │       │           └── route.ts    # POST trigger enrichment
│   │       ├── signals/
│   │       │   └── [id]/
│   │       │       └── route.ts        # PUT (confirm/dismiss), DELETE
│   │       ├── enrich/
│   │       │   └── route.ts            # POST global enrichment
│   │       └── dashboard/
│   │           └── stats/
│   │               └── route.ts        # GET KPI stats
│   └── components/
│       ├── Header.tsx                  # App header with title + Add Account button
│       ├── KpiCards.tsx                # 4 KPI summary cards
│       ├── AccountTable.tsx            # Filterable, searchable account table
│       ├── AccountFilters.tsx          # Search bar + stage/type dropdowns
│       ├── AccountForm.tsx             # Add/Edit account modal form
│       ├── AccountDetail.tsx           # Two-column account detail layout
│       ├── SignalTimeline.tsx           # Signal list with confirm/dismiss
│       ├── SignalForm.tsx              # Add signal modal form
│       ├── StageBadge.tsx              # Colored stage badge
│       ├── TypeBadge.tsx               # Colored type badge
│       └── Toast.tsx                   # Simple toast notification
├── scripts/
│   └── seed.ts                         # Demo seed data script
└── docs/
    └── superpowers/
        ├── specs/
        │   └── 2026-03-16-strategic-account-tracker-design.md
        └── plans/
            └── 2026-03-16-strategic-account-tracker.md
```

---

## Chunk 1: Project Setup + Data Layer

### Task 1: Initialize Next.js project

**Files:**
- Create: `package.json`, `next.config.js`, `tailwind.config.ts`, `tsconfig.json`, `postcss.config.js`, `.gitignore`, `.env.local`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Scaffold Next.js with TypeScript and Tailwind**

```bash
cd /Users/visheshpaliwal/repo/lem-all/strategic-account-tracker
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```

- [ ] **Step 2: Create .env.local**

```bash
# .env.local
MONGODB_URI=
SERPER_API_KEY=
```

Leave values empty — user will fill in their connection string and API key.

- [ ] **Step 3: Add .superpowers/ to .gitignore**

Append `.superpowers/` to the generated `.gitignore`.

- [ ] **Step 4: Verify dev server starts**

```bash
npm run dev
```

Expected: Server starts on localhost:3000, default Next.js page renders.

- [ ] **Step 5: Commit**

```bash
git init
git add -A
git commit -m "chore: initialize Next.js 14 project with TypeScript and Tailwind"
```

---

### Task 2: MongoDB connection + constants

**Files:**
- Create: `src/lib/mongodb.ts`
- Create: `src/lib/constants.ts`

- [ ] **Step 1: Install mongoose**

```bash
npm install mongoose
```

- [ ] **Step 2: Create MongoDB connection singleton**

Create `src/lib/mongodb.ts`:

```typescript
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable in .env.local");
}

let cached = global as typeof globalThis & {
  mongoose: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
};

if (!cached.mongoose) {
  cached.mongoose = { conn: null, promise: null };
}

async function dbConnect(): Promise<typeof mongoose> {
  if (cached.mongoose.conn) {
    return cached.mongoose.conn;
  }

  if (!cached.mongoose.promise) {
    cached.mongoose.promise = mongoose.connect(MONGODB_URI, {
      dbName: "strategic-account-tracker",
    });
  }

  cached.mongoose.conn = await cached.mongoose.promise;
  return cached.mongoose.conn;
}

export default dbConnect;
```

- [ ] **Step 3: Create constants file**

Create `src/lib/constants.ts`:

```typescript
export const ACCOUNT_TYPES = ["Customer", "Partner", "Investor", "Ecosystem"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const STAGES = [
  "Identified",
  "Researching",
  "Engaged",
  "Pilot Discussion",
  "Active Pilot",
  "Customer/Partner",
  "Churned",
] as const;
export type Stage = (typeof STAGES)[number];

export const SIGNAL_TYPES = [
  "Hiring",
  "Funding",
  "Partnership",
  "Product Launch",
  "Expansion",
  "News",
  "Regulatory Approval",
  "Scale-up Announcement",
  "Meeting",
  "Email",
  "Other",
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

export const SIGNAL_SOURCES = ["Manual", "Serper", "RSS"] as const;
export type SignalSource = (typeof SIGNAL_SOURCES)[number];

export const SIGNAL_STATUSES = ["Confirmed", "Suggested", "Dismissed"] as const;
export type SignalStatus = (typeof SIGNAL_STATUSES)[number];

export const TOUCHPOINT_TYPES: SignalType[] = ["Meeting", "Email"];
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/mongodb.ts src/lib/constants.ts package.json package-lock.json
git commit -m "feat: add MongoDB connection singleton and enum constants"
```

---

### Task 3: Mongoose models

**Files:**
- Create: `src/lib/models/account.ts`
- Create: `src/lib/models/signal.ts`

- [ ] **Step 1: Create Account model**

Create `src/lib/models/account.ts`:

```typescript
import mongoose, { Schema, Document, Model } from "mongoose";
import { ACCOUNT_TYPES, STAGES, AccountType, Stage } from "../constants";

export interface IAccount extends Document {
  name: string;
  type: AccountType;
  stage: Stage;
  website?: string;
  linkedinUrl?: string;
  opportunityHypothesis: string;
  founderNote?: string;
  nextAction?: string;
  nextActionDate?: Date;
  lastTouchpoint?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<IAccount>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ACCOUNT_TYPES, required: true },
    stage: { type: String, enum: STAGES, required: true },
    website: { type: String },
    linkedinUrl: { type: String },
    opportunityHypothesis: { type: String, required: true },
    founderNote: { type: String },
    nextAction: { type: String },
    nextActionDate: { type: Date },
    lastTouchpoint: { type: Date },
  },
  { timestamps: true }
);

const Account: Model<IAccount> =
  mongoose.models.Account || mongoose.model<IAccount>("Account", AccountSchema);

export default Account;
```

- [ ] **Step 2: Create Signal model**

Create `src/lib/models/signal.ts`:

```typescript
import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { SIGNAL_TYPES, SIGNAL_SOURCES, SIGNAL_STATUSES, SignalType, SignalSource, SignalStatus } from "../constants";

export interface ISignal extends Document {
  accountId: Types.ObjectId;
  type: SignalType;
  source: SignalSource;
  title: string;
  note?: string;
  url?: string;
  status: SignalStatus;
  date: Date;
  createdAt: Date;
}

const SignalSchema = new Schema<ISignal>(
  {
    accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true, index: true },
    type: { type: String, enum: SIGNAL_TYPES, required: true },
    source: { type: String, enum: SIGNAL_SOURCES, required: true },
    title: { type: String, required: true },
    note: { type: String },
    url: { type: String },
    status: { type: String, enum: SIGNAL_STATUSES, required: true },
    date: { type: Date, required: true },
  },
  { timestamps: true }
);

const Signal: Model<ISignal> =
  mongoose.models.Signal || mongoose.model<ISignal>("Signal", SignalSchema);

export default Signal;
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/models/
git commit -m "feat: add Account and Signal Mongoose models"
```

---

## Chunk 2: API Routes — Accounts

### Task 4: Accounts list + create API

**Files:**
- Create: `src/app/api/accounts/route.ts`

- [ ] **Step 1: Create accounts list and create route**

Create `src/app/api/accounts/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Account from "@/lib/models/account";
import Signal from "@/lib/models/signal";

export async function GET(request: NextRequest) {
  await dbConnect();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const type = searchParams.get("type");
  const stage = searchParams.get("stage");

  const filter: Record<string, unknown> = {};
  if (search) filter.name = { $regex: search, $options: "i" };
  if (type) filter.type = type;
  if (stage) filter.stage = stage;

  const accounts = await Account.find(filter)
    .sort({ nextActionDate: 1 })
    .lean();

  // Attach latest confirmed signal to each account
  const accountIds = accounts.map((a) => a._id);
  const latestSignals = await Signal.aggregate([
    { $match: { accountId: { $in: accountIds }, status: "Confirmed" } },
    { $sort: { date: -1 } },
    { $group: { _id: "$accountId", signal: { $first: "$$ROOT" } } },
  ]);

  const signalMap = new Map(latestSignals.map((s) => [s._id.toString(), s.signal]));

  const result = accounts.map((account) => ({
    ...account,
    latestSignal: signalMap.get(account._id.toString()) || null,
  }));

  // Sort: accounts with nextActionDate first (ascending), then those without
  result.sort((a, b) => {
    if (a.nextActionDate && b.nextActionDate) {
      return new Date(a.nextActionDate).getTime() - new Date(b.nextActionDate).getTime();
    }
    if (a.nextActionDate && !b.nextActionDate) return -1;
    if (!a.nextActionDate && b.nextActionDate) return 1;
    return 0;
  });

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  await dbConnect();
  const body = await request.json();
  const account = await Account.create(body);
  return NextResponse.json(account, { status: 201 });
}
```

- [ ] **Step 2: Test with curl (requires MONGODB_URI set in .env.local)**

```bash
# Start dev server, then in another terminal:
curl -X POST http://localhost:3000/api/accounts \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Co","type":"Customer","stage":"Identified","opportunityHypothesis":"Testing"}'
# Expected: 201 with created account JSON

curl http://localhost:3000/api/accounts
# Expected: 200 with array containing the test account
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/accounts/route.ts
git commit -m "feat: add accounts list and create API routes"
```

---

### Task 5: Single account CRUD API

**Files:**
- Create: `src/app/api/accounts/[id]/route.ts`

- [ ] **Step 1: Create single account GET/PUT/DELETE**

Create `src/app/api/accounts/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Account from "@/lib/models/account";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const account = await Account.findById(id).lean();
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(account);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const body = await request.json();
  const account = await Account.findByIdAndUpdate(id, body, { new: true, runValidators: true }).lean();
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(account);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const account = await Account.findByIdAndDelete(id);
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/accounts/\\[id\\]/route.ts
git commit -m "feat: add single account GET/PUT/DELETE API routes"
```

---

### Task 6: Signals API routes

**Files:**
- Create: `src/app/api/accounts/[id]/signals/route.ts`
- Create: `src/app/api/signals/[id]/route.ts`

- [ ] **Step 1: Create signals list + create route**

Create `src/app/api/accounts/[id]/signals/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Signal from "@/lib/models/signal";
import Account from "@/lib/models/account";
import { TOUCHPOINT_TYPES } from "@/lib/constants";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const signals = await Signal.find({ accountId: id, status: { $ne: "Dismissed" } })
    .sort({ date: -1 })
    .lean();
  return NextResponse.json(signals);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const body = await request.json();

  const signal = await Signal.create({
    ...body,
    accountId: id,
    source: "Manual",
    status: "Confirmed",
  });

  // Auto-update lastTouchpoint for touchpoint-type signals
  if (TOUCHPOINT_TYPES.includes(body.type)) {
    await Account.findByIdAndUpdate(id, { lastTouchpoint: body.date });
  }

  return NextResponse.json(signal, { status: 201 });
}
```

- [ ] **Step 2: Create signal update + delete route**

Create `src/app/api/signals/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Signal from "@/lib/models/signal";
import Account from "@/lib/models/account";
import { TOUCHPOINT_TYPES } from "@/lib/constants";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const body = await request.json();
  const signal = await Signal.findByIdAndUpdate(id, body, { new: true }).lean();
  if (!signal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If confirming a touchpoint-type signal, update lastTouchpoint
  if (body.status === "Confirmed" && TOUCHPOINT_TYPES.includes(signal.type)) {
    await Account.findByIdAndUpdate(signal.accountId, { lastTouchpoint: signal.date });
  }

  return NextResponse.json(signal);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const signal = await Signal.findByIdAndDelete(id);
  if (!signal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/accounts/\\[id\\]/signals/ src/app/api/signals/
git commit -m "feat: add signal CRUD API routes"
```

---

### Task 7: Dashboard stats API

**Files:**
- Create: `src/app/api/dashboard/stats/route.ts`

- [ ] **Step 1: Create stats route**

Create `src/app/api/dashboard/stats/route.ts`:

```typescript
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Account from "@/lib/models/account";
import Signal from "@/lib/models/signal";

export async function GET() {
  await dbConnect();

  const [totalAccounts, activePilots, pendingActions, newSignals] = await Promise.all([
    Account.countDocuments(),
    Account.countDocuments({ stage: "Active Pilot" }),
    Account.countDocuments({ nextAction: { $exists: true, $ne: "" } }),
    Signal.countDocuments({ status: "Suggested" }),
  ]);

  return NextResponse.json({ totalAccounts, activePilots, pendingActions, newSignals });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/dashboard/stats/
git commit -m "feat: add dashboard stats API route"
```

---

## Chunk 3: Signal Enrichment

### Task 8: Serper client

**Files:**
- Create: `src/lib/enrichment/serper.ts`

- [ ] **Step 1: Create Serper API client**

Create `src/lib/enrichment/serper.ts`:

```typescript
interface SerperResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
}

interface SerperResponse {
  organic?: SerperResult[];
  news?: SerperResult[];
}

export async function searchSerper(companyName: string): Promise<SerperResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: `"${companyName}" news OR announcement OR funding OR hiring`,
        num: 5,
      }),
    });

    if (!response.ok) return [];

    const data: SerperResponse = await response.json();
    const results = [...(data.news || []), ...(data.organic || [])];
    return results.slice(0, 5);
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/enrichment/serper.ts
git commit -m "feat: add Serper.dev API client for signal enrichment"
```

---

### Task 9: Google News RSS parser

**Files:**
- Create: `src/lib/enrichment/rss.ts`

- [ ] **Step 1: Create RSS parser**

Create `src/lib/enrichment/rss.ts`:

```typescript
interface RssItem {
  title: string;
  link: string;
  pubDate: string;
}

export async function fetchNewsRss(companyName: string): Promise<RssItem[]> {
  try {
    const query = encodeURIComponent(companyName);
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

    const response = await fetch(url);
    if (!response.ok) return [];

    const xml = await response.text();

    // Simple XML parsing — extract <item> blocks
    const items: RssItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
      const itemXml = match[1];
      const title = itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1") || "";
      const link = itemXml.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "";
      const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "";

      if (title && link) {
        items.push({ title, link, pubDate });
      }
    }

    return items;
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/enrichment/rss.ts
git commit -m "feat: add Google News RSS parser for signal enrichment"
```

---

### Task 10: Signal categorization

**Files:**
- Create: `src/lib/enrichment/categorize.ts`

- [ ] **Step 1: Create keyword-to-type categorizer**

Create `src/lib/enrichment/categorize.ts`:

```typescript
import { SignalType } from "../constants";

const KEYWORD_MAP: { type: SignalType; keywords: string[] }[] = [
  { type: "Hiring", keywords: ["hired", "hiring", "job", "recruit", "appoint"] },
  { type: "Funding", keywords: ["raised", "funding", "series", "round", "investment", "capital"] },
  { type: "Partnership", keywords: ["partner", "partnership", "collaborate", "alliance", "joint"] },
  { type: "Expansion", keywords: ["expand", "facility", "new site", "scale", "capacity"] },
  { type: "Product Launch", keywords: ["launch", "release", "announce product", "unveil"] },
  { type: "Regulatory Approval", keywords: ["fda", "ema", "approved", "clearance", "regulatory"] },
  { type: "Scale-up Announcement", keywords: ["scale-up", "scale up", "production ramp"] },
];

export function categorizeSignal(title: string): SignalType {
  const lower = title.toLowerCase();
  for (const { type, keywords } of KEYWORD_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return type;
    }
  }
  return "News";
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/enrichment/categorize.ts
git commit -m "feat: add signal auto-categorization by keyword matching"
```

---

### Task 11: Enrichment orchestrator + API routes

**Files:**
- Create: `src/lib/enrichment/enrich.ts`
- Create: `src/app/api/accounts/[id]/enrich/route.ts`
- Create: `src/app/api/enrich/route.ts`

- [ ] **Step 1: Create enrichment orchestrator**

Create `src/lib/enrichment/enrich.ts`:

```typescript
import { Types } from "mongoose";
import dbConnect from "../mongodb";
import Signal from "../models/signal";
import { searchSerper } from "./serper";
import { fetchNewsRss } from "./rss";
import { categorizeSignal } from "./categorize";

interface RawSignal {
  title: string;
  url: string;
  date: string;
  source: "Serper" | "RSS";
}

function dedup(signals: RawSignal[]): RawSignal[] {
  const seen = new Map<string, RawSignal>();

  for (const signal of signals) {
    // Dedup by exact URL
    if (signal.url && seen.has(signal.url)) continue;

    // Dedup by title substring containment
    const lowerTitle = signal.title.toLowerCase();
    let isDup = false;
    for (const [, existing] of seen) {
      const existingLower = existing.title.toLowerCase();
      if (lowerTitle.includes(existingLower) || existingLower.includes(lowerTitle)) {
        isDup = true;
        break;
      }
    }
    if (isDup) continue;

    seen.set(signal.url || signal.title, signal);
  }

  return Array.from(seen.values());
}

export async function enrichAccount(accountId: string, companyName: string): Promise<number> {
  await dbConnect();

  const [serperResults, rssResults] = await Promise.all([
    searchSerper(companyName),
    fetchNewsRss(companyName),
  ]);

  const rawSignals: RawSignal[] = [
    ...serperResults.map((r) => ({
      title: r.title,
      url: r.link,
      date: r.date || new Date().toISOString(),
      source: "Serper" as const,
    })),
    ...rssResults.map((r) => ({
      title: r.title,
      url: r.link,
      date: r.pubDate || new Date().toISOString(),
      source: "RSS" as const,
    })),
  ];

  const deduped = dedup(rawSignals);

  // Filter out signals that already exist for this account (by URL or title)
  const existingSignals = await Signal.find({ accountId: new Types.ObjectId(accountId) }).lean();
  const existingUrls = new Set(existingSignals.map((s) => s.url).filter(Boolean));
  const existingTitles = new Set(existingSignals.map((s) => s.title.toLowerCase()));

  const newSignals = deduped.filter((s) => {
    if (s.url && existingUrls.has(s.url)) return false;
    if (existingTitles.has(s.title.toLowerCase())) return false;
    return true;
  });

  if (newSignals.length === 0) return 0;

  const signalDocs = newSignals.map((s) => ({
    accountId: new Types.ObjectId(accountId),
    type: categorizeSignal(s.title),
    source: s.source,
    title: s.title,
    url: s.url,
    status: "Suggested",
    date: new Date(s.date),
  }));

  await Signal.insertMany(signalDocs);
  return signalDocs.length;
}
```

- [ ] **Step 2: Create per-account enrichment route**

Create `src/app/api/accounts/[id]/enrich/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Account from "@/lib/models/account";
import { enrichAccount } from "@/lib/enrichment/enrich";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const account = await Account.findById(id).lean();
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const count = await enrichAccount(id, account.name);
  return NextResponse.json({ newSignals: count });
}
```

- [ ] **Step 3: Create global enrichment route**

Create `src/app/api/enrich/route.ts`:

```typescript
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Account from "@/lib/models/account";
import { enrichAccount } from "@/lib/enrichment/enrich";

export async function POST() {
  await dbConnect();
  const accounts = await Account.find().lean();

  let totalNew = 0;
  for (const account of accounts) {
    const count = await enrichAccount(account._id.toString(), account.name);
    totalNew += count;
  }

  return NextResponse.json({ accountsProcessed: accounts.length, newSignals: totalNew });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/enrichment/enrich.ts src/app/api/accounts/\\[id\\]/enrich/ src/app/api/enrich/
git commit -m "feat: add signal enrichment orchestrator and API routes"
```

---

## Chunk 4: Frontend — Dashboard

### Task 12: AccountForm + Root layout + Header

**Files:**
- Create: `src/components/AccountForm.tsx`
- Create: `src/components/Header.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create AccountForm component**

Create `src/components/AccountForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { ACCOUNT_TYPES, STAGES } from "@/lib/constants";

interface Props {
  account?: {
    _id: string;
    name: string;
    type: string;
    stage: string;
    website?: string;
    linkedinUrl?: string;
    opportunityHypothesis: string;
    founderNote?: string;
    nextAction?: string;
    nextActionDate?: string;
  };
  onClose: () => void;
  onSaved: () => void;
}

export default function AccountForm({ account, onClose, onSaved }: Props) {
  const isEdit = !!account;
  const [form, setForm] = useState({
    name: account?.name || "",
    type: account?.type || "Customer",
    stage: account?.stage || "Identified",
    website: account?.website || "",
    linkedinUrl: account?.linkedinUrl || "",
    opportunityHypothesis: account?.opportunityHypothesis || "",
    founderNote: account?.founderNote || "",
    nextAction: account?.nextAction || "",
    nextActionDate: account?.nextActionDate?.split("T")[0] || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const url = isEdit ? `/api/accounts/${account._id}` : "/api/accounts";
    const method = isEdit ? "PUT" : "POST";

    const body = {
      ...form,
      nextActionDate: form.nextActionDate || undefined,
    };

    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);

    if (!res.ok) {
      setError("Failed to save account. Please try again.");
      return;
    }

    onSaved();
  };

  const inputClass =
    "w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none";
  const labelClass = "block text-xs font-medium text-gray-400 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-gray-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold text-white">{isEdit ? "Edit Account" : "Add Account"}</h2>
        {error && <div className="mb-3 rounded-lg bg-red-900/50 px-3 py-2 text-sm text-red-400">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelClass}>Company Name *</label>
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Type *</label>
              <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Stage *</label>
              <select className={inputClass} value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Opportunity Hypothesis *</label>
            <textarea className={inputClass} rows={2} value={form.opportunityHypothesis} onChange={(e) => setForm({ ...form, opportunityHypothesis: e.target.value })} required />
          </div>
          <div>
            <label className={labelClass}>Founder Note</label>
            <textarea className={inputClass} rows={2} value={form.founderNote} onChange={(e) => setForm({ ...form, founderNote: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Website</label>
              <input className={inputClass} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" />
            </div>
            <div>
              <label className={labelClass}>LinkedIn URL</label>
              <input className={inputClass} value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/company/..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Next Action</label>
              <input className={inputClass} value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Action Due Date</label>
              <input type="date" className={inputClass} value={form.nextActionDate} onChange={(e) => setForm({ ...form, nextActionDate: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving..." : isEdit ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create Header component**

Create `src/components/Header.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AccountForm from "./AccountForm";

export default function Header() {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <header className="border-b border-gray-800 bg-gray-950 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="text-xl font-bold text-white">Strategic Account Tracker</h1>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add Account
          </button>
        </div>
      </header>
      {showForm && (
        <AccountForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Update root layout**

Replace `src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Strategic Account Tracker",
  description: "Founder-level strategic account tracking for Lemnisca Bio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-gray-100`}>
        <Header />
        <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/Header.tsx src/app/layout.tsx
git commit -m "feat: add root layout with dark theme and header"
```

---

### Task 13: Badge components

**Files:**
- Create: `src/components/StageBadge.tsx`
- Create: `src/components/TypeBadge.tsx`

- [ ] **Step 1: Create StageBadge**

Create `src/components/StageBadge.tsx`:

```tsx
import { Stage } from "@/lib/constants";

const STAGE_COLORS: Record<Stage, string> = {
  Identified: "bg-gray-800 text-gray-300",
  Researching: "bg-indigo-900/50 text-indigo-400",
  Engaged: "bg-yellow-900/50 text-yellow-400",
  "Pilot Discussion": "bg-green-900/50 text-green-400",
  "Active Pilot": "bg-emerald-900/50 text-emerald-400",
  "Customer/Partner": "bg-blue-900/50 text-blue-400",
  Churned: "bg-red-900/50 text-red-400",
};

export default function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[stage]}`}>
      {stage}
    </span>
  );
}
```

- [ ] **Step 2: Create TypeBadge**

Create `src/components/TypeBadge.tsx`:

```tsx
import { AccountType } from "@/lib/constants";

const TYPE_COLORS: Record<AccountType, string> = {
  Customer: "bg-blue-900/50 text-blue-400",
  Partner: "bg-green-900/50 text-green-400",
  Investor: "bg-purple-900/50 text-purple-400",
  Ecosystem: "bg-yellow-900/50 text-yellow-400",
};

export default function TypeBadge({ type }: { type: AccountType }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[type]}`}>
      {type}
    </span>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/StageBadge.tsx src/components/TypeBadge.tsx
git commit -m "feat: add Stage and Type badge components"
```

---

### Task 14: KPI Cards component

**Files:**
- Create: `src/components/KpiCards.tsx`

- [ ] **Step 1: Create KpiCards**

Create `src/components/KpiCards.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

interface Stats {
  totalAccounts: number;
  activePilots: number;
  pendingActions: number;
  newSignals: number;
}

export default function KpiCards() {
  const [stats, setStats] = useState<Stats>({ totalAccounts: 0, activePilots: 0, pendingActions: 0, newSignals: 0 });

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const cards = [
    { label: "ACCOUNTS", value: stats.totalAccounts, color: "text-white" },
    { label: "ACTIVE PILOTS", value: stats.activePilots, color: "text-emerald-400" },
    { label: "PENDING ACTIONS", value: stats.pendingActions, color: "text-yellow-400" },
    { label: "NEW SIGNALS", value: stats.newSignals, color: "text-red-400" },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg bg-gray-900 p-4">
          <div className="text-xs text-gray-500">{card.label}</div>
          <div className={`mt-1 text-2xl font-bold ${card.color}`}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/KpiCards.tsx
git commit -m "feat: add KPI summary cards component"
```

---

### Task 15: Account filters + table

**Files:**
- Create: `src/components/AccountFilters.tsx`
- Create: `src/components/AccountTable.tsx`

- [ ] **Step 1: Create AccountFilters**

Create `src/components/AccountFilters.tsx`:

```tsx
"use client";

import { ACCOUNT_TYPES, STAGES } from "@/lib/constants";

interface Props {
  search: string;
  type: string;
  stage: string;
  onSearchChange: (v: string) => void;
  onTypeChange: (v: string) => void;
  onStageChange: (v: string) => void;
}

export default function AccountFilters({ search, type, stage, onSearchChange, onTypeChange, onStageChange }: Props) {
  const selectClass =
    "rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:border-blue-500 focus:outline-none";

  return (
    <div className="flex items-center gap-3">
      <input
        type="text"
        placeholder="Search accounts..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
      />
      <select value={stage} onChange={(e) => onStageChange(e.target.value)} className={selectClass}>
        <option value="">All Stages</option>
        {STAGES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select value={type} onChange={(e) => onTypeChange(e.target.value)} className={selectClass}>
        <option value="">All Types</option>
        {ACCOUNT_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Create AccountTable**

Create `src/components/AccountTable.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import StageBadge from "./StageBadge";
import TypeBadge from "./TypeBadge";
import AccountFilters from "./AccountFilters";

import { AccountType, Stage } from "@/lib/constants";

interface AccountRow {
  _id: string;
  name: string;
  type: AccountType;
  stage: Stage;
  nextAction?: string;
  nextActionDate?: string;
  latestSignal?: { title: string; date: string } | null;
}

export default function AccountTable() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [stage, setStage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (type) params.set("type", type);
    if (stage) params.set("stage", stage);

    setLoading(true);
    fetch(`/api/accounts?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setAccounts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [search, type, stage]);

  return (
    <div className="space-y-4">
      <AccountFilters
        search={search}
        type={type}
        stage={stage}
        onSearchChange={setSearch}
        onTypeChange={setType}
        onStageChange={setStage}
      />

      {loading ? (
        <div className="py-12 text-center text-gray-500">Loading...</div>
      ) : accounts.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          No accounts yet — add your first strategic account
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-800">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50 text-left text-xs text-gray-500">
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Latest Signal</th>
                <th className="px-4 py-3">Next Action</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr
                  key={account._id}
                  onClick={() => router.push(`/accounts/${account._id}`)}
                  className="cursor-pointer border-b border-gray-800/50 hover:bg-gray-900/30"
                >
                  <td className="px-4 py-3 font-medium text-blue-400">{account.name}</td>
                  <td className="px-4 py-3">
                    <TypeBadge type={account.type} />
                  </td>
                  <td className="px-4 py-3">
                    <StageBadge stage={account.stage} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {account.latestSignal ? (
                      <>
                        {account.latestSignal.title}
                        <span className="ml-2 text-gray-600">
                          {new Date(account.latestSignal.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-yellow-400">
                    {account.nextAction || <span className="text-gray-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/AccountFilters.tsx src/components/AccountTable.tsx
git commit -m "feat: add account filters and table components"
```

---

### Task 16: Dashboard page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Wire up dashboard page**

Replace `src/app/page.tsx` with:

```tsx
import KpiCards from "@/components/KpiCards";
import AccountTable from "@/components/AccountTable";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <KpiCards />
      <AccountTable />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire up dashboard page with KPI cards and account table"
```

---

## Chunk 5: Frontend — Account Detail

### Task 17: Toast component

**Files:**
- Create: `src/components/Toast.tsx`

- [ ] **Step 1: Create Toast**

Create `src/components/Toast.tsx`:

```tsx
"use client";

import { useEffect } from "react";

interface Props {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
}

export default function Toast({ message, type = "info", onClose }: Props) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: "bg-green-900/80 text-green-300 border-green-700",
    error: "bg-red-900/80 text-red-300 border-red-700",
    info: "bg-gray-800 text-gray-300 border-gray-700",
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg ${colors[type]}`}>
      {message}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Toast.tsx
git commit -m "feat: add toast notification component"
```

---

### Task 18: Signal timeline component

**Files:**
- Create: `src/components/SignalTimeline.tsx`

- [ ] **Step 1: Create SignalTimeline**

Create `src/components/SignalTimeline.tsx`:

```tsx
"use client";

import { useState } from "react";

interface Signal {
  _id: string;
  type: string;
  source: string;
  title: string;
  note?: string;
  url?: string;
  status: string;
  date: string;
}

interface Props {
  signals: Signal[];
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function SignalTimeline({ signals, onConfirm, onDismiss, onDelete }: Props) {
  if (signals.length === 0) {
    return <div className="py-8 text-center text-sm text-gray-500">No signals yet</div>;
  }

  return (
    <div className="border-l-2 border-gray-800 pl-4 space-y-4">
      {signals.map((signal) => (
        <div key={signal._id} className={`relative ${signal.status === "Suggested" ? "rounded-lg border border-yellow-800/50 bg-yellow-900/10 p-3" : ""}`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-gray-500">
                {new Date(signal.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {" · "}
                <span className={signal.status === "Confirmed" ? "text-green-400" : "text-yellow-400"}>
                  {signal.status}
                </span>
              </div>
              <div className="mt-1 text-sm text-white">
                {signal.url ? (
                  <a href={signal.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">
                    {signal.title}
                  </a>
                ) : (
                  signal.title
                )}
              </div>
              <div className="mt-0.5 text-xs text-gray-500">
                Type: {signal.type} · Source: {signal.source}
              </div>
              {signal.note && <div className="mt-1 text-xs text-gray-400">{signal.note}</div>}
            </div>
            <div className="flex items-center gap-1 ml-2">
              {signal.status === "Suggested" && (
                <>
                  <button
                    onClick={() => onConfirm(signal._id)}
                    className="rounded bg-green-900/50 px-2 py-1 text-xs text-green-400 hover:bg-green-900"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => onDismiss(signal._id)}
                    className="rounded bg-red-900/50 px-2 py-1 text-xs text-red-400 hover:bg-red-900"
                  >
                    Dismiss
                  </button>
                </>
              )}
              {signal.source === "Manual" && (
                <button
                  onClick={() => onDelete(signal._id)}
                  className="rounded px-2 py-1 text-xs text-gray-500 hover:text-red-400"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SignalTimeline.tsx
git commit -m "feat: add signal timeline component with confirm/dismiss/delete"
```

---

### Task 19: Signal form modal

**Files:**
- Create: `src/components/SignalForm.tsx`

- [ ] **Step 1: Create SignalForm**

Create `src/components/SignalForm.tsx`:

```tsx
"use client";

import { useState } from "react";
import { SIGNAL_TYPES } from "@/lib/constants";

interface Props {
  accountId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function SignalForm({ accountId, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    type: "Meeting",
    title: "",
    note: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/accounts/${accountId}/signals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, date: new Date(form.date) }),
    });
    setSaving(false);
    if (!res.ok) return;
    onSaved();
  };

  const inputClass =
    "w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none";
  const labelClass = "block text-xs font-medium text-gray-400 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-gray-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold text-white">Add Signal</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelClass}>Signal Type *</label>
            <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {SIGNAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Title *</label>
            <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g., Met CTO at SynBioBeta" />
          </div>
          <div>
            <label className={labelClass}>Note</label>
            <textarea className={inputClass} rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Additional context..." />
          </div>
          <div>
            <label className={labelClass}>Date *</label>
            <input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving..." : "Add Signal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SignalForm.tsx
git commit -m "feat: add signal form modal component"
```

---

### Task 20: Account detail page

**Files:**
- Create: `src/app/accounts/[id]/page.tsx`

- [ ] **Step 1: Create account detail page**

Create `src/app/accounts/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import StageBadge from "@/components/StageBadge";
import TypeBadge from "@/components/TypeBadge";
import SignalTimeline from "@/components/SignalTimeline";
import SignalForm from "@/components/SignalForm";
import AccountForm from "@/components/AccountForm";
import Toast from "@/components/Toast";
import { AccountType, Stage } from "@/lib/constants";

interface Account {
  _id: string;
  name: string;
  type: AccountType;
  stage: Stage;
  website?: string;
  linkedinUrl?: string;
  opportunityHypothesis: string;
  founderNote?: string;
  nextAction?: string;
  nextActionDate?: string;
  lastTouchpoint?: string;
}

interface Signal {
  _id: string;
  type: string;
  source: string;
  title: string;
  note?: string;
  url?: string;
  status: string;
  date: string;
}

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [showSignalForm, setShowSignalForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const fetchAccount = useCallback(async () => {
    const res = await fetch(`/api/accounts/${id}`);
    if (!res.ok) return router.push("/");
    setAccount(await res.json());
  }, [id, router]);

  const fetchSignals = useCallback(async () => {
    const res = await fetch(`/api/accounts/${id}/signals`);
    setSignals(await res.json());
  }, [id]);

  useEffect(() => {
    fetchAccount();
    fetchSignals();
  }, [fetchAccount, fetchSignals]);

  const handleConfirm = async (signalId: string) => {
    await fetch(`/api/signals/${signalId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Confirmed" }),
    });
    fetchSignals();
    fetchAccount();
  };

  const handleDismiss = async (signalId: string) => {
    await fetch(`/api/signals/${signalId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Dismissed" }),
    });
    fetchSignals();
  };

  const handleDelete = async (signalId: string) => {
    await fetch(`/api/signals/${signalId}`, { method: "DELETE" });
    fetchSignals();
  };

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      const res = await fetch(`/api/accounts/${id}/enrich`, { method: "POST" });
      const data = await res.json();
      if (data.newSignals > 0) {
        setToast({ message: `Found ${data.newSignals} new signal(s)`, type: "success" });
      } else {
        setToast({ message: "No new signals found", type: "info" });
      }
      fetchSignals();
    } catch {
      setToast({ message: "Enrichment unavailable", type: "error" });
    }
    setEnriching(false);
  };

  if (!account) return <div className="py-12 text-center text-gray-500">Loading...</div>;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <button onClick={() => router.push("/")} className="text-sm text-blue-400 hover:text-blue-300">
            ← Back to accounts
          </button>
          <h2 className="mt-2 text-2xl font-bold text-white">{account.name}</h2>
          <div className="mt-2 flex gap-2">
            <TypeBadge type={account.type} />
            <StageBadge stage={account.stage} />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowEditForm(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Edit
          </button>
          <button
            onClick={handleEnrich}
            disabled={enriching}
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50"
          >
            {enriching ? "Refreshing..." : "Refresh Signals"}
          </button>
          <button
            onClick={async () => {
              if (!confirm("Delete this account? This cannot be undone.")) return;
              await fetch(`/api/accounts/${id}`, { method: "DELETE" });
              router.push("/");
            }}
            className="rounded-lg bg-red-900/50 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-900"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left: Account context */}
        <div className="space-y-4">
          <div className="rounded-lg bg-gray-900 p-4">
            <div className="text-xs font-medium text-gray-500">OPPORTUNITY HYPOTHESIS</div>
            <div className="mt-2 text-sm text-gray-300">{account.opportunityHypothesis}</div>
          </div>

          {account.founderNote && (
            <div className="rounded-lg bg-gray-900 p-4">
              <div className="text-xs font-medium text-gray-500">FOUNDER NOTE</div>
              <div className="mt-2 text-sm text-gray-300">{account.founderNote}</div>
            </div>
          )}

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
              <div className="text-xs font-medium text-gray-500">LAST TOUCHPOINT</div>
              <div className="mt-2 text-sm text-gray-300">
                {account.lastTouchpoint
                  ? new Date(account.lastTouchpoint).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "—"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {account.website && (
              <div className="rounded-lg bg-gray-900 p-4">
                <div className="text-xs font-medium text-gray-500">WEBSITE</div>
                <a href={account.website} target="_blank" rel="noopener noreferrer" className="mt-2 block text-sm text-blue-400 hover:text-blue-300 truncate">
                  {account.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
            {account.linkedinUrl && (
              <div className="rounded-lg bg-gray-900 p-4">
                <div className="text-xs font-medium text-gray-500">LINKEDIN</div>
                <a href={account.linkedinUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block text-sm text-blue-400 hover:text-blue-300 truncate">
                  LinkedIn →
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Right: Signal Timeline */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Signal Timeline</h3>
            <button
              onClick={() => setShowSignalForm(true)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              + Add Signal
            </button>
          </div>
          <SignalTimeline signals={signals} onConfirm={handleConfirm} onDismiss={handleDismiss} onDelete={handleDelete} />
        </div>
      </div>

      {/* Modals */}
      {showSignalForm && (
        <SignalForm
          accountId={id}
          onClose={() => setShowSignalForm(false)}
          onSaved={() => { setShowSignalForm(false); fetchSignals(); fetchAccount(); }}
        />
      )}
      {showEditForm && (
        <AccountForm
          account={account}
          onClose={() => setShowEditForm(false)}
          onSaved={() => { setShowEditForm(false); fetchAccount(); }}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/accounts/
git commit -m "feat: add account detail page with two-column layout"
```

---

## Chunk 6: Seed Data + Final Polish

### Task 21: Seed script

**Files:**
- Create: `scripts/seed.ts`

- [ ] **Step 1: Install tsx for running TypeScript scripts**

```bash
npm install -D tsx
```

- [ ] **Step 2: Create seed script**

Create `scripts/seed.ts`:

```typescript
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const MONGODB_URI = process.env.MONGODB_URI!;

const AccountSchema = new mongoose.Schema(
  {
    name: String,
    type: String,
    stage: String,
    website: String,
    linkedinUrl: String,
    opportunityHypothesis: String,
    founderNote: String,
    nextAction: String,
    nextActionDate: Date,
    lastTouchpoint: Date,
  },
  { timestamps: true }
);

const SignalSchema = new mongoose.Schema(
  {
    accountId: mongoose.Schema.Types.ObjectId,
    type: String,
    source: String,
    title: String,
    note: String,
    url: String,
    status: String,
    date: Date,
  },
  { timestamps: true }
);

const Account = mongoose.model("Account", AccountSchema);
const Signal = mongoose.model("Signal", SignalSchema);

const SEED_ACCOUNTS = [
  {
    name: "Ginkgo Bioworks",
    type: "Customer",
    stage: "Pilot Discussion",
    website: "https://www.ginkgobioworks.com",
    opportunityHypothesis: "Leading synthetic biology platform with 3000+ fermentation runs/year. Scaling challenges reported in Q3 earnings. Digital twin could reduce batch failure rate by 15-20%.",
    founderNote: "Met CTO at SynBioBeta. Strong technical alignment. They're actively evaluating process optimization tools for their foundry.",
    nextAction: "Schedule demo call with VP Manufacturing",
    nextActionDate: new Date("2026-03-20"),
    lastTouchpoint: new Date("2026-03-12"),
  },
  {
    name: "Novozymes",
    type: "Partner",
    stage: "Engaged",
    website: "https://www.novozymes.com",
    opportunityHypothesis: "Global leader in biological solutions. Partnership could give Lemnisca access to enzyme production expertise and pilot facilities. Merging with Chr. Hansen creates even larger opportunity.",
    founderNote: "Innovation team is exploring digital tools for process optimization. Warm intro via YC network.",
    nextAction: "Send case study on fermentation optimization",
    nextActionDate: new Date("2026-03-18"),
    lastTouchpoint: new Date("2026-03-08"),
  },
  {
    name: "Culture Biosciences",
    type: "Customer",
    stage: "Researching",
    website: "https://www.culturebiosciences.com",
    opportunityHypothesis: "Cloud bioreactor company — they run fermentation-as-a-service. Digital twin integration could be a huge value-add for their customers. Natural platform partnership.",
    nextAction: "Find intro through shared investors",
    nextActionDate: new Date("2026-03-25"),
  },
  {
    name: "PointOne Capital",
    type: "Investor",
    stage: "Engaged",
    website: "https://www.pointonecapital.com",
    opportunityHypothesis: "Early-stage deep-tech VC with biotech focus. Already participated in pre-seed. Key relationship for seed round and strategic introductions.",
    founderNote: "Strong relationship with GP. Keep updated on traction metrics monthly.",
    nextAction: "Send monthly update with pilot metrics",
    nextActionDate: new Date("2026-03-30"),
    lastTouchpoint: new Date("2026-03-01"),
  },
  {
    name: "SynBioBeta",
    type: "Ecosystem",
    stage: "Engaged",
    website: "https://www.synbiobeta.com",
    opportunityHypothesis: "Premier synthetic biology conference and community. Key for visibility, recruiting, and BD connections in the biomanufacturing ecosystem.",
    founderNote: "Applied to speak at next conference. Good place to meet potential customers and partners.",
    nextAction: "Submit speaker application for fall conference",
    nextActionDate: new Date("2026-04-15"),
    lastTouchpoint: new Date("2026-02-20"),
  },
];

async function seed() {
  await mongoose.connect(MONGODB_URI, { dbName: "strategic-account-tracker" });
  console.log("Connected to MongoDB");

  // Clear existing data
  await Account.deleteMany({});
  await Signal.deleteMany({});
  console.log("Cleared existing data");

  // Create accounts
  const accounts = await Account.insertMany(SEED_ACCOUNTS);
  console.log(`Created ${accounts.length} accounts`);

  // Create sample signals for Ginkgo Bioworks
  const ginkgo = accounts.find((a) => a.name === "Ginkgo Bioworks")!;
  await Signal.insertMany([
    {
      accountId: ginkgo._id,
      type: "Hiring",
      source: "Serper",
      title: "Ginkgo Bioworks hires VP of Manufacturing Operations",
      status: "Confirmed",
      date: new Date("2026-03-12"),
    },
    {
      accountId: ginkgo._id,
      type: "Expansion",
      source: "RSS",
      title: "Ginkgo Bioworks announces new Boston manufacturing facility",
      url: "https://example.com/ginkgo-boston",
      status: "Confirmed",
      date: new Date("2026-03-05"),
    },
    {
      accountId: ginkgo._id,
      type: "Partnership",
      source: "Serper",
      title: "Ginkgo Bioworks partners with Bayer CropScience on bio-agriculture",
      url: "https://example.com/ginkgo-bayer",
      status: "Suggested",
      date: new Date("2026-02-20"),
    },
    {
      accountId: ginkgo._id,
      type: "Meeting",
      source: "Manual",
      title: "Met CTO at SynBioBeta conference",
      note: "Discussed digital twin approach. Strong interest in reducing batch failures.",
      status: "Confirmed",
      date: new Date("2026-02-10"),
    },
  ]);

  // Create sample signals for Novozymes
  const novozymes = accounts.find((a) => a.name === "Novozymes")!;
  await Signal.insertMany([
    {
      accountId: novozymes._id,
      type: "News",
      source: "RSS",
      title: "Novozymes-Chr. Hansen merger creates global biosolutions leader",
      status: "Confirmed",
      date: new Date("2026-03-01"),
    },
    {
      accountId: novozymes._id,
      type: "Email",
      source: "Manual",
      title: "Introductory email to innovation team",
      note: "Warm intro from YC contact. Discussed potential collaboration areas.",
      status: "Confirmed",
      date: new Date("2026-03-08"),
    },
  ]);

  console.log("Created sample signals");
  console.log("Seed complete!");
  await mongoose.disconnect();
}

seed().catch(console.error);
```

- [ ] **Step 3: Add seed script to package.json**

Add to the `scripts` section of `package.json`:

```json
"seed": "tsx scripts/seed.ts"
```

- [ ] **Step 4: Install dotenv**

```bash
npm install dotenv
```

- [ ] **Step 5: Run seed (requires MONGODB_URI in .env.local)**

```bash
npm run seed
```

Expected: "Created 5 accounts", "Created sample signals", "Seed complete!"

- [ ] **Step 6: Commit**

```bash
git add scripts/seed.ts package.json package-lock.json
git commit -m "feat: add demo seed data script with 5 biomanufacturing accounts"
```

---

### Task 22: Update Tailwind config for dark theme

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Ensure dark mode is class-based**

Check `tailwind.config.ts` — if `darkMode` is not set, add `darkMode: "class"` to the config. Also ensure the content paths include `src/` directory.

- [ ] **Step 2: Update globals.css for dark baseline**

Ensure `src/app/globals.css` has proper dark background:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #030712;
  color: #f3f4f6;
}
```

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts src/app/globals.css
git commit -m "chore: configure Tailwind dark theme"
```

---

### Task 23: End-to-end smoke test

- [ ] **Step 1: Set MONGODB_URI and SERPER_API_KEY in .env.local**

User fills in their Atlas connection string and Serper API key.

- [ ] **Step 2: Run seed data**

```bash
npm run seed
```

- [ ] **Step 3: Start dev server and verify**

```bash
npm run dev
```

Verify in browser at http://localhost:3000:
- Dashboard shows 4 KPI cards with correct counts
- 5 accounts appear in the table sorted by next action date
- Filters (search, stage, type dropdowns) work
- Click an account row → detail page loads
- Two-column layout: info left, signals right
- Signal timeline shows correct signals for Ginkgo
- "Add Signal" modal works
- "Refresh Signals" button triggers enrichment
- Suggested signals show Confirm/Dismiss buttons
- "Edit" button opens pre-filled account form
- Back button returns to dashboard
- "+ Add Account" in header creates a new account

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final polish and smoke test verification"
```

---

## Summary

| Chunk | Tasks | What it delivers |
|-------|-------|-----------------|
| 1: Setup + Data Layer | 1–3 | Next.js project, MongoDB connection, Mongoose models |
| 2: Account APIs | 4–7 | Full CRUD for accounts, signals, dashboard stats |
| 3: Signal Enrichment | 8–11 | Serper + RSS enrichment pipeline with categorization |
| 4: Dashboard Frontend | 12–16 | AccountForm, Header, badges, KPI cards, filterable table, dashboard page |
| 5: Account Detail | 17–20 | Toast, signal timeline, signal form, detail page with delete |
| 6: Seed + Polish | 21–23 | Demo data, dark theme, end-to-end verification |
