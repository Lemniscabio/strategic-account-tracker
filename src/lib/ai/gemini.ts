import {
  GoogleGenerativeAI,
  SchemaType,
  DynamicRetrievalMode,
  type FunctionDeclaration,
  type Content,
  type Part,
} from "@google/generative-ai";

const MODEL = "gemini-2.5-flash";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is required");
  return new GoogleGenerativeAI(apiKey);
}

export async function generateJSON<T = unknown>(
  prompt: string,
  systemPrompt?: string
): Promise<T> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: { responseMimeType: "application/json" },
  });

  const contents: Content[] = [];
  if (systemPrompt) {
    contents.push({ role: "user", parts: [{ text: systemPrompt }] });
    contents.push({ role: "model", parts: [{ text: "Understood." }] });
  }
  contents.push({ role: "user", parts: [{ text: prompt }] });

  const result = await model.generateContent({ contents });
  const text = result.response.text();
  return JSON.parse(text) as T;
}

export async function generateStream(
  messages: { role: "user" | "model"; content: string }[],
  systemPrompt?: string
): Promise<AsyncGenerator<string>> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: MODEL });

  const contents: Content[] = [];
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

  const result = await model.generateContentStream({ contents });

  async function* streamText() {
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  }

  return streamText();
}

// Custom tool definitions for the chat agent (Tavily-powered)
export const CHAT_FUNCTION_TOOLS: FunctionDeclaration[] = [
  {
    name: "extract_article_content",
    description:
      "Extract the full content of a URL (article, press release, etc) using Tavily. Use this when the user asks about details of a specific signal and you have its URL. This works even on paywalled or JS-heavy sites.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        url: {
          type: SchemaType.STRING,
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
      type: SchemaType.OBJECT,
      properties: {
        query: {
          type: SchemaType.STRING,
          description: "The search query",
        },
      },
      required: ["query"],
    },
  },
];

// Tool handler type
export type ToolHandler = (name: string, args: Record<string, string>) => Promise<string>;

/**
 * Generate a streaming response with tool-calling support.
 * When the model calls a tool, we execute it and continue the conversation.
 */
export async function generateStreamWithTools(
  messages: { role: "user" | "model"; content: string }[],
  systemPrompt: string,
  tools: FunctionDeclaration[],
  handleToolCall: ToolHandler
): Promise<AsyncGenerator<string>> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL,
    tools: [
      { functionDeclarations: tools },
      { googleSearchRetrieval: { dynamicRetrievalConfig: { mode: DynamicRetrievalMode.MODE_DYNAMIC } } },
    ],
  });

  const contents: Content[] = [];
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
    let currentContents = [...contents];
    let maxToolRounds = 3; // prevent infinite loops

    while (maxToolRounds > 0) {
      const result = await model.generateContentStream({ contents: currentContents });

      let hasToolCall = false;
      const responseParts: Part[] = [];

      for await (const chunk of result.stream) {
        // Check for function calls
        const fnCalls = chunk.functionCalls();
        if (fnCalls && fnCalls.length > 0) {
          hasToolCall = true;
          for (const fc of fnCalls) {
            responseParts.push({ functionCall: { name: fc.name, args: fc.args } });
          }
        }

        // Stream any text
        const text = chunk.text();
        if (text) {
          responseParts.push({ text });
          yield text;
        }
      }

      if (!hasToolCall) {
        // No tool calls — we're done
        break;
      }

      // Add the model's response (with tool calls) to conversation
      currentContents.push({ role: "model", parts: responseParts });

      // Execute each tool call and build function response parts
      const functionResponseParts: Part[] = [];
      for (const part of responseParts) {
        if (part.functionCall) {
          const toolName = part.functionCall.name;
          const toolArgs = part.functionCall.args as Record<string, string>;

          const statusMsg = toolName === "web_search" ? "🔍 *Searching the web...*" : "📡 *Extracting article content...*";
          yield `\n\n${statusMsg}\n\n`;

          const toolResult = await handleToolCall(toolName, toolArgs);
          functionResponseParts.push({
            functionResponse: {
              name: toolName,
              response: { content: toolResult },
            },
          });
        }
      }

      // Add tool results to conversation
      currentContents.push({ role: "user", parts: functionResponseParts });
      maxToolRounds--;
    }
  }

  return streamWithToolLoop();
}
