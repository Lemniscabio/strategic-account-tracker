/**
 * Tavily API client for search and URL content extraction.
 * Free tier: 1,000 credits/month (1 credit = 1 search or 5 URL extracts)
 */

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilySearchResponse {
  results: TavilySearchResult[];
  answer?: string;
}

interface TavilyExtractResult {
  url: string;
  raw_content: string;
}

interface TavilyExtractResponse {
  results: TavilyExtractResult[];
  failed_results?: { url: string; error: string }[];
}

function getApiKey(): string | null {
  return process.env.TAVILY_API_KEY || null;
}

/**
 * Search the web using Tavily. Returns top results with content snippets.
 * Cost: 1 credit per search.
 */
export async function tavilySearch(query: string, maxResults = 3): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) return "Tavily API key not configured.";

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        include_answer: true,
        search_depth: "basic",
      }),
    });

    if (!res.ok) return `Tavily search failed: ${res.status}`;

    const data: TavilySearchResponse = await res.json();

    let output = "";
    if (data.answer) {
      output += `Summary: ${data.answer}\n\n`;
    }
    output += "Sources:\n";
    for (const r of data.results) {
      output += `- ${r.title}\n  ${r.url}\n  ${r.content.slice(0, 300)}\n\n`;
    }

    return output || "No results found.";
  } catch (err) {
    return `Tavily search error: ${err instanceof Error ? err.message : "Unknown error"}`;
  }
}

/**
 * Extract content from a URL using Tavily. Better than raw fetch for
 * paywalled/JS-heavy sites.
 * Cost: 1 credit per 5 URLs.
 */
export async function tavilyExtract(url: string): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) return "Tavily API key not configured.";

  try {
    const res = await fetch("https://api.tavily.com/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        urls: [url],
      }),
    });

    if (!res.ok) return `Tavily extract failed: ${res.status}`;

    const data: TavilyExtractResponse = await res.json();

    if (data.results && data.results.length > 0) {
      const content = data.results[0].raw_content;
      if (content.length > 5000) {
        return content.slice(0, 5000) + "\n\n[Content truncated...]";
      }
      return content;
    }

    if (data.failed_results && data.failed_results.length > 0) {
      return `Could not extract content: ${data.failed_results[0].error}`;
    }

    return "No content extracted.";
  } catch (err) {
    return `Tavily extract error: ${err instanceof Error ? err.message : "Unknown error"}`;
  }
}
