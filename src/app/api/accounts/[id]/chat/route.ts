import { NextRequest } from "next/server";
import dbConnect from "@/lib/mongodb";
import Account from "@/lib/models/account";
import Signal from "@/lib/models/signal";
import { generateStreamWithTools, CHAT_FUNCTION_TOOLS } from "@/lib/ai/gemini";
import { tavilyExtract, tavilySearch } from "@/lib/ai/tavily";

export const dynamic = "force-dynamic";

function buildSystemPrompt(account: Record<string, unknown>, signals: Record<string, unknown>[]): string {
  const signalList = signals
    .slice(0, 15)
    .map((s) => {
      const score = s.relevanceScore ? `[${s.relevanceScore}/5]` : "[unscored]";
      const reason = s.scoreReason ? ` — ${s.scoreReason}` : "";
      const url = s.url ? ` | URL: ${s.url}` : "";
      return `${score} ${s.title} (${s.type}, ${s.source}, ${new Date(s.date as string).toLocaleDateString()})${reason}${url}`;
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
6. Use the extract_article_content tool to read the actual article/press release content from a signal's URL. The signal URLs are listed above.
7. Use the web_search tool to search the web for additional context when you need more information about a company, topic, or when article extraction fails.
Be concise. Speak like a smart analyst briefing a founder.
When the user asks about details of a specific signal, USE extract_article_content to read the article. If that fails, USE web_search to find the information.`;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const { id } = await params;

  const account = await Account.findById(id).lean();
  if (!account) {
    return new Response("Account not found", { status: 404 });
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

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const gen = await generateStreamWithTools(
          messages,
          systemPrompt,
          CHAT_FUNCTION_TOOLS,
          async (toolName, args) => {
            if (toolName === "extract_article_content" && args.url) {
              return await tavilyExtract(args.url);
            }
            if (toolName === "web_search" && args.query) {
              return await tavilySearch(args.query);
            }
            return "Unknown tool";
          }
        );
        for await (const chunk of gen) {
          controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: [ERROR] ${msg}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
