import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-2.5-flash-preview-05-20";

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

  const contents = [];
  if (systemPrompt) {
    contents.push({ role: "user" as const, parts: [{ text: systemPrompt }] });
    contents.push({ role: "model" as const, parts: [{ text: "Understood." }] });
  }
  contents.push({ role: "user" as const, parts: [{ text: prompt }] });

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

  const contents = [];
  if (systemPrompt) {
    contents.push({ role: "user" as const, parts: [{ text: systemPrompt }] });
    contents.push({ role: "model" as const, parts: [{ text: "Understood." }] });
  }
  for (const msg of messages) {
    contents.push({
      role: msg.role === "user" ? ("user" as const) : ("model" as const),
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
