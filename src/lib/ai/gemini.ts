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
  // Debug: log grounding metadata
  const metadata = result.candidates?.[0]?.groundingMetadata;
  console.log("[Chat] Grounding chunks:", metadata?.groundingChunks?.length ?? 0);

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

  console.log("[Chat] Sources extracted:", sources.length, sources.map(s => s.title));
  const fullText = result.text || "";

  // Simulate streaming by yielding text in chunks
  async function* streamText() {
    // Yield text in ~100 char chunks for smooth streaming feel
    const chunkSize = 100;
    for (let i = 0; i < fullText.length; i += chunkSize) {
      yield fullText.slice(i, i + chunkSize);
      // Small delay for streaming feel (only in chunks, not blocking)
    }

    // Yield sources as a separate marker (no leading newline to avoid SSE break)
    if (sources.length > 0) {
      yield `SOURCES:${JSON.stringify(sources)}`;
    }
  }

  return streamText();
}
