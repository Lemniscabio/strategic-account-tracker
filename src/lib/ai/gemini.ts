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
 * Collects grounding sources and appends them as SOURCES: marker at end.
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

  // Use non-streaming to get grounding metadata (streaming doesn't include it reliably)
  // Then stream the text to the client
  const result = await client.models.generateContent({
    model: MODEL,
    contents,
    config: {
      tools: [
        { googleSearch: {} },
        { urlContext: {} },
      ],
    },
  });

  const sources: GroundingSource[] = [];

  // Extract grounding sources from the response
  // Log full grounding metadata to debug what's available
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

  const fullText = result.text || "";

  async function* streamText() {
    // Yield full text as one chunk (frontend waits for complete response)
    yield fullText;

    // Yield sources as separate marker
    if (sources.length > 0) {
      yield `SOURCES:${JSON.stringify(sources)}`;
    }
  }

  return streamText();
}
