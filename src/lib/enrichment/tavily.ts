/**
 * Tavily-powered enrichment source.
 * Returns search results WITH content snippets for quality-aware scoring.
 */

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  published_date?: string;
  score: number;
}

interface TavilyResponse {
  results: TavilyResult[];
}

export interface TavilySignal {
  title: string;
  url: string;
  snippet: string;
  date: string;
}

export async function searchTavily(
  companyName: string,
  keywords: string[] = []
): Promise<TavilySignal[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  const query = keywords.length > 0
    ? `${companyName} ${keywords.join(" ")} news announcement`
    : `${companyName} news announcement funding hiring`;

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 5,
        search_depth: "basic",
        include_answer: false,
      }),
    });

    if (!res.ok) return [];

    const data: TavilyResponse = await res.json();

    return data.results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content.slice(0, 500),
      date: r.published_date || new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}
