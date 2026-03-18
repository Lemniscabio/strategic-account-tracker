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

export interface GroundingSource {
  title: string;
  url: string;
}

/**
 * Generate a streaming chat response with built-in Google Search + URL Context.
 * Returns text chunks AND grounding sources at the end.
 *
 * The last yielded item starting with "SOURCES:" contains JSON array of sources.
 */
export async function generateStreamWithSearch(
  messages: { role: "user" | "model"; content: string }[],
  systemPrompt: string
): Promise<AsyncGenerator<string>> {
  const client = getClient();

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
    const sources: GroundingSource[] = [];

    for await (const chunk of response) {
      if (chunk.text) {
        yield chunk.text;
      }

      // Extract grounding sources from candidates
      if (chunk.candidates) {
        for (const candidate of chunk.candidates) {
          const metadata = candidate.groundingMetadata;
          if (metadata?.groundingChunks) {
            for (const gc of metadata.groundingChunks) {
              if (gc.web?.uri && gc.web?.title) {
                // Avoid duplicates
                if (!sources.some((s) => s.url === gc.web!.uri)) {
                  sources.push({ title: gc.web.title, url: gc.web.uri });
                }
              }
            }
          }
        }
      }
    }

    // Yield sources as a special marker at the end
    if (sources.length > 0) {
      yield `\nSOURCES:${JSON.stringify(sources)}`;
    }
  }

  return streamText();
}
