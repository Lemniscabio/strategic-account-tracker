import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Account from "@/lib/models/account";
import Signal from "@/lib/models/signal";
import { enrichAccount } from "@/lib/enrichment/enrich";
import { scoreSignals } from "@/lib/ai/scoring";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;
  const account = await Account.findById(id).lean();
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    // Enrich with keywords
    const newSignals = await enrichAccount(id, account.name, account.keywords || []);

    // Chain scoring for new unscored signals
    let scored = 0;
    let dismissed = 0;

    if (newSignals > 0) {
      const unscoredSignals = await Signal.find({
        accountId: id,
        status: "Suggested",
        relevanceScore: null,
      }).lean();

      if (unscoredSignals.length > 0) {
        try {
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

          for (const { signalId, score, reason } of scores) {
            const update: Record<string, unknown> = { relevanceScore: score, scoreReason: reason };
            if (score < 2) {
              update.status = "Dismissed";
              dismissed++;
            }
            await Signal.findByIdAndUpdate(signalId, update);
          }
          scored = scores.length;
        } catch (err) {
          console.error("[enrich] Scoring failed, signals saved without scores:", err instanceof Error ? err.message : err);
        }
      }
    }

    return NextResponse.json({ newSignals, scored, dismissed });
  } catch (err) {
    console.error("[enrich] Enrichment failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Enrichment failed", details: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
