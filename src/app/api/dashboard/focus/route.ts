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
        tier: acct.tier || "C",
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
      const tier = a.tier || "C";
      const threshold = STALE_THRESHOLDS[tier] || 30;
      const daysSince = Math.floor((now.getTime() - new Date(a.lastTouchpoint!).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince < threshold) return null;

      const lastNote = a.touchpoints && a.touchpoints.length > 0
        ? [...a.touchpoints].sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())[0].note
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
