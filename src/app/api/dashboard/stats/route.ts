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
