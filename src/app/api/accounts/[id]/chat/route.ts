import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Account from "@/lib/models/account";
import Signal from "@/lib/models/signal";
import { generateChatResponse } from "@/lib/ai/gemini";

export const dynamic = "force-dynamic";

function buildSystemPrompt(account: Record<string, unknown>, signals: Record<string, unknown>[]): string {
  const signalList = signals
    .slice(0, 15)
    .map((s) => {
      const score = s.relevanceScore ? `[${s.relevanceScore}/5]` : "[unscored]";
      const reason = s.scoreReason ? ` — ${s.scoreReason}` : "";
      const url = s.url ? ` | URL: ${s.url}` : "";
      const snippet = s.snippet ? `\n  Content: ${(s.snippet as string).slice(0, 200)}` : "";
      return `${score} ${s.title} (${s.type}, ${s.source}, ${new Date(s.date as string).toLocaleDateString()})${reason}${url}${snippet}`;
    })
    .join("\n");

  return `You are an AI assistant for a strategic account tracker used by a biomanufacturing/CDMO-focused investment firm (Lemniscate).

You are viewing account: ${account.name}
Type: ${account.type} | Stage: ${account.stage}
Opportunity Hypothesis: ${account.opportunityHypothesis}
${account.founderNote ? `Founder Notes: ${account.founderNote}` : ""}
${(account.keywords as string[])?.length > 0 ? `Keywords: ${(account.keywords as string[]).join(", ")}` : "No keywords set"}
Last Touchpoint: ${account.lastTouchpoint ? new Date(account.lastTouchpoint as string).toLocaleDateString() : "None"}
Next Action: ${account.nextAction || "None"}${account.nextActionDate ? ` (due: ${new Date(account.nextActionDate as string).toLocaleDateString()})` : ""}

Current signals (sorted by relevance):
${signalList || "No signals yet"}

You can:
1. Explain why any signal is relevant to Lemniscate's thesis
2. Suggest keywords to track — when suggesting, include this exact JSON format in your response: {"suggestedKeywords": ["keyword1", "keyword2"]}
3. Give a 30-second briefing on the account
4. Recommend concrete next actions based on signals and stage
5. Answer freeform questions about the account

RESPONSE RULES:
- Be concise. Speak like a smart analyst briefing a founder.
- NEVER mention your tools, browsing process, URLs you visited, or what succeeded/failed. The user does not care how you got the information — only the insights matter.
- NEVER say things like "the URL was noted as incorrect", "I browsed the page", "the content was not accessible", "I will search for...", "Let me look up...". Just give the answer.
- Structure with markdown: use **bold** for key points, bullet lists for details, ### headings for sections.
- Keep responses focused and well-structured.
- When suggesting keywords, include: {"suggestedKeywords": ["kw1", "kw2"]}`;
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
    .sort({ relevanceScore: -1, date: -1 })
    .limit(15)
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
