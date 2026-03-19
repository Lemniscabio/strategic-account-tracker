import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Account from "@/lib/models/account";
import Signal from "@/lib/models/signal";
import { scoreSignals } from "@/lib/ai/scoring";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;

  const account = await Account.findById(id).lean();
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check if rescore mode (clear existing scores first)
  const body = await request.json().catch(() => ({}));
  if (body.rescore) {
    await Signal.updateMany(
      { accountId: id, status: "Suggested" },
      { $unset: { relevanceScore: "", scoreReason: "" } }
    );
  }

  // Fetch unscored Suggested signals
  const unscoredSignals = await Signal.find({
    accountId: id,
    status: "Suggested",
    relevanceScore: null,
  }).lean();

  console.log(`[score-route] Found ${unscoredSignals.length} unscored signals for account ${id}`);
  if (unscoredSignals.length === 0) {
    // Debug: check total signals for this account
    const totalSignals = await Signal.countDocuments({ accountId: id });
    const suggestedSignals = await Signal.countDocuments({ accountId: id, status: "Suggested" });
    console.log(`[score-route] Total signals: ${totalSignals}, Suggested: ${suggestedSignals}`);
    return NextResponse.json({ scored: 0, dismissed: 0 });
  }

  const scores = await scoreSignals(
    {
      name: account.name,
      type: account.type,
      stage: account.stage,
      opportunityHypothesis: account.opportunityHypothesis,
      keywords: account.keywords || [],
    },
    unscoredSignals.map((s) => ({
      _id: s._id.toString(),
      title: s.title,
      snippet: s.snippet || "",
      source: s.source,
      type: s.type,
      date: s.date.toISOString(),
    }))
  );

  let dismissed = 0;

  for (const { signalId, score, reason } of scores) {
    const update: Record<string, unknown> = { relevanceScore: score, scoreReason: reason };
    if (score < 2) {
      update.status = "Dismissed";
      dismissed++;
    }
    await Signal.findByIdAndUpdate(signalId, update);
  }

  return NextResponse.json({ scored: scores.length, dismissed });
}
