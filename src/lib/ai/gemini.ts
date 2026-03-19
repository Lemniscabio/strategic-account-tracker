import { GoogleGenAI } from "@google/genai";

const CHAT_MODEL = "gemini-2.5-pro";
const SCORING_MODEL = "gemini-2.5-flash";

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
    model: SCORING_MODEL,
    contents,
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = result.text || "";
  return JSON.parse(text) as T;
}

export interface GroundingSource {
  title: string;
  url: string;
}

export interface ChatResponse {
  text: string;
  sources: GroundingSource[];
}

/**
 * Generate a chat response with Google Search + URL Context grounding.
 * Returns the complete response with text and grounding sources.
 */
export async function generateChatResponse(
  messages: { role: "user" | "model"; content: string }[],
  systemPrompt: string
): Promise<ChatResponse> {
  const client = getClient();

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  for (const msg of messages) {
    contents.push({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    });
  }

  const result = await client.models.generateContent({
    model: CHAT_MODEL,
    contents,
    config: {
      systemInstruction: systemPrompt,
      tools: [
        { googleSearch: {} },
        { urlContext: {} },
      ],
    },
  });

  const sources: GroundingSource[] = [];

  if (result.candidates) {
    for (const candidate of result.candidates) {
      const metadata = candidate.groundingMetadata;
      if (metadata?.groundingChunks) {
        for (const gc of metadata.groundingChunks) {
          if (gc.web?.uri && gc.web?.title) {
            if (!sources.some((s) => s.url === gc.web!.uri)) {
              sources.push({ title: gc.web.title, url: gc.web.uri });
            }
          }
        }
      }
    }
  }

  return {
    text: result.text || "",
    sources,
  };
}
