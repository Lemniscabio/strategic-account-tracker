import { GoogleGenAI } from "@google/genai";

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

/**
 * Generate a streaming chat response with built-in Google Search + URL Context.
 *
 * - googleSearch: Model automatically searches the web when it needs real-time info
 * - urlContext: Model can read specific URLs (signal articles, press releases)
 *
 * No function calling needed — both are native Gemini tools.
 */
export async function generateStreamWithSearch(
  messages: { role: "user" | "model"; content: string }[],
  systemPrompt: string
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

  const response = await client.models.generateContentStream({
    model: MODEL,
    contents,
    config: {
      tools: [
        { googleSearch: {} },
        { urlContext: {} },
      ],
    },
  });

  async function* streamText() {
    for await (const chunk of response) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  }

  return streamText();
}
