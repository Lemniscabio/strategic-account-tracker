import {
  GoogleGenerativeAI,
  SchemaType,
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

// Tool definitions for the chat agent
export const CHAT_TOOLS: FunctionDeclaration[] = [
  {
    name: "fetch_signal_content",
    description:
      "Fetch the full content of a signal's URL (article, press release, etc). Use this when the user asks about the details of a specific signal and you need to read the actual article content to give an accurate answer.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        url: {
          type: SchemaType.STRING,
          description: "The URL of the signal to fetch content from",
        },
      },
      required: ["url"],
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
    tools: [{ functionDeclarations: tools }],
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

          yield `\n\n📡 *Fetching article content...*\n\n`;

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
