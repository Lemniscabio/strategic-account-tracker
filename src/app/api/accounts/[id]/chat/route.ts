import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Account from "@/lib/models/account";
import Signal from "@/lib/models/signal";
import { generateChatResponse } from "@/lib/ai/gemini";

export const dynamic = "force-dynamic";

function buildSystemPrompt(account: Record<string, unknown>, signals: Record<string, unknown>[]): string {
  const signalList = signals
    .map((s, i) => {
      const status = s.status === "Suggested" ? " [SUGGESTED]" : "";
      const url = s.url ? ` | ${s.url}` : "";
      return `${i + 1}. ${s.title}${status} (${s.type}, ${new Date(s.date as string).toLocaleDateString()})${url}`;
    })
    .join("\n");

  const touchpoints = (account.touchpoints as { date: Date; note: string; outcome: string }[]) || [];
  const touchpointList = [...touchpoints]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((tp) => {
      const outcome = tp.outcome ? ` → ${tp.outcome}` : "";
      return `- ${new Date(tp.date).toLocaleDateString()}: ${tp.note}${outcome}`;
    })
    .join("\n");

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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;

  const account = await Account.findById(id).lean();
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const body = await request.json();
  const messages: { role: "user" | "model"; content: string }[] = (body.messages || []).slice(-10);

  const signals = await Signal.find({ accountId: id, status: { $ne: "Dismissed" } })
    .select("title type url status date")
    .sort({ date: -1 })
    .lean();

  const systemPrompt = buildSystemPrompt(
    account as unknown as Record<string, unknown>,
    signals as unknown as Record<string, unknown>[]
  );

  try {
    const response = await generateChatResponse(messages, systemPrompt);
    return NextResponse.json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ text: `Error: ${msg}`, sources: [] }, { status: 500 });
  }
}
