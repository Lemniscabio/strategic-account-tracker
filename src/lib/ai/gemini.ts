import { GoogleGenAI, Type } from "@google/genai";

const MODEL = "gemini-2.5-flash";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is required");
  return new GoogleGenAI({ apiKey });
}

export async function generateJSON<T = unknown>(
  prompt: string,
  systemPrompt?: string
): Promise<T> {
  const client = getClient();

  const contents = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

  const result = await client.models.generateContent({
    model: MODEL,
    contents,
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = result.text || "";
  return JSON.parse(text) as T;
}

// Custom function tool definitions for the chat agent (Tavily-powered)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FUNCTION_DECLARATIONS: any[] = [
  {
    name: "extract_article_content",
    description:
      "Extract the full content of a URL (article, press release, etc) using Tavily. Use this when the user asks about details of a specific signal and you have its URL. This works even on paywalled or JS-heavy sites.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: "The URL to extract content from",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "web_search",
    description:
      "Search the web for information using Tavily. Use this when you need to find additional context about a signal, company, or topic that isn't in your current context. Also use this as a fallback when extract_article_content fails.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "The search query",
        },
      },
      required: ["query"],
    },
  },
];

export type ToolHandler = (name: string, args: Record<string, string>) => Promise<string>;

/**
 * Generate a streaming response with Google Search grounding + custom tools.
 * The model can:
 * 1. Use Google Search grounding automatically (built-in)
 * 2. Call our custom Tavily tools (extract_article_content, web_search)
 */
export async function generateStreamWithTools(
  messages: { role: "user" | "model"; content: string }[],
  systemPrompt: string,
  handleToolCall: ToolHandler
): Promise<AsyncGenerator<string>> {
  const client = getClient();

  // Build conversation history
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  if (systemPrompt) {
    contents.push({ role: "user", parts: [{ text: systemPrompt }] });
    contents.push({ role: "model", parts: [{ text: "Understood." }] });
  }
  for (const msg of messages) {
    contents.push({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    });
  }

  async function* streamWithToolLoop(): AsyncGenerator<string> {
    let maxToolRounds = 3;

    // First call with all tools enabled
    let response = await client.models.generateContentStream({
      model: MODEL,
      contents,
      config: {
        tools: [
          { functionDeclarations: FUNCTION_DECLARATIONS },
          { googleSearch: {} },
        ],
      },
    });

    while (maxToolRounds > 0) {
      let hasCustomToolCall = false;
      const functionCalls: Array<{ name: string; args: Record<string, string> }> = [];

      for await (const chunk of response) {
        // Handle text chunks
        if (chunk.text) {
          yield chunk.text;
        }

        // Check for custom function calls
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          for (const fc of chunk.functionCalls) {
            // Only handle our custom tools, not google_search (that's handled by Gemini)
            if (fc.name === "extract_article_content" || fc.name === "web_search") {
              hasCustomToolCall = true;
              functionCalls.push({ name: fc.name, args: fc.args as Record<string, string> });
            }
          }
        }
      }

      if (!hasCustomToolCall) break;

      // Execute custom tool calls
      const functionResponses = [];
      for (const fc of functionCalls) {
        const statusMsg = fc.name === "web_search" ? "🔍 *Searching the web...*" : "📡 *Extracting article content...*";
        yield `\n\n${statusMsg}\n\n`;

        const result = await handleToolCall(fc.name, fc.args);
        functionResponses.push({
          name: fc.name,
          response: { content: result },
        });
      }

      // Continue conversation with tool results — use non-streaming for the follow-up
      // then stream the final response
      const followUp = await client.models.generateContentStream({
        model: MODEL,
        contents: [
          ...contents,
          {
            role: "model",
            parts: functionCalls.map((fc) => ({
              functionCall: { name: fc.name, args: fc.args },
            })),
          },
          {
            role: "user",
            parts: functionResponses.map((fr) => ({
              functionResponse: fr,
            })),
          },
        ],
        config: {
          tools: [
            { functionDeclarations: FUNCTION_DECLARATIONS },
            { googleSearch: {} },
          ],
        },
      });

      response = followUp;
      maxToolRounds--;
    }
  }

  return streamWithToolLoop();
}
