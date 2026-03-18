/**
 * Fetch and extract readable text content from a URL.
 * Used as a tool by the AI chat agent to read signal articles.
 */
export async function fetchUrlContent(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SignalTracker/1.0)",
        Accept: "text/html,application/xhtml+xml,text/plain",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return `Failed to fetch: ${res.status} ${res.statusText}`;

    const html = await res.text();

    // Strip HTML tags, scripts, styles to get readable text
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    // Truncate to ~4000 chars to stay within context limits
    if (text.length > 4000) {
      return text.slice(0, 4000) + "\n\n[Content truncated...]";
    }

    return text || "No readable content found at this URL.";
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return "Request timed out after 10 seconds.";
    }
    return `Error fetching URL: ${err instanceof Error ? err.message : "Unknown error"}`;
  }
}
