export const dynamic = "force-dynamic";

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
  const tier = searchParams.get("tier");
  if (tier) filter.tier = tier;

  const accounts = await Account.find(filter)
    .sort({ tier: 1, nextActionDate: 1 })
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

  // Sort: tier first (A before B before C), then by nextActionDate
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

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  await dbConnect();
  const body = await request.json();

  const now = new Date();
  body.touchpoints = [{ date: now, note: "Started tracking", outcome: "" }];
  body.lastTouchpoint = now;

  const account = await Account.create(body);
  return NextResponse.json(account, { status: 201 });
}
