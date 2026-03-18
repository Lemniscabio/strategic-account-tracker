/**
 * Fetch and extract readable text content from a URL.
 * Used as a tool by the AI chat agent to read signal articles.
 */

function stripHtml(html: string): string {
  return html
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
}

async function fetchWithRetry(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    // Use a real browser User-Agent to avoid bot blocks
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Google News URLs (news.google.com) are redirects. Extract the actual URL.
 */
function resolveGoogleNewsUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // Google News RSS links contain the real URL in various forms
    if (u.hostname === "news.google.com") {
      // Try to extract from query params
      const articleUrl = u.searchParams.get("url");
      if (articleUrl) return articleUrl;
    }
  } catch {
    // Not a valid URL
  }
  return null;
}

export async function fetchUrlContent(url: string): Promise<string> {
  try {
    // Try to resolve Google News redirects
    const resolved = resolveGoogleNewsUrl(url);
    const targetUrl = resolved || url;

    const res = await fetchWithRetry(targetUrl);

    if (!res.ok) {
      // If the original URL failed and we didn't try resolving, try following redirects manually
      if (!resolved && res.status >= 300 && res.status < 400) {
        const redirectUrl = res.headers.get("location");
        if (redirectUrl) {
          const redirectRes = await fetchWithRetry(redirectUrl);
          if (redirectRes.ok) {
            const html = await redirectRes.text();
            const text = stripHtml(html);
            if (text.length > 4000) {
              return text.slice(0, 4000) + "\n\n[Content truncated...]";
            }
            return text || "No readable content found.";
          }
        }
      }
      return `Failed to fetch (${res.status}). The article may be behind a paywall or require browser access.`;
    }

    // Check if we got redirected to a consent/cookie page
    const finalUrl = res.url;
    const html = await res.text();

    // If the page is very short, it might be a redirect page
    if (html.length < 500 && html.includes("redirect")) {
      // Try to extract redirect URL from meta refresh
      const metaMatch = html.match(/content=["']\d+;url=([^"']+)/i);
      if (metaMatch) {
        const metaRes = await fetchWithRetry(metaMatch[1]);
        if (metaRes.ok) {
          const metaHtml = await metaRes.text();
          const text = stripHtml(metaHtml);
          if (text.length > 4000) {
            return text.slice(0, 4000) + "\n\n[Content truncated...]";
          }
          return text || "No readable content found.";
        }
      }
    }

    const text = stripHtml(html);

    if (text.length < 100) {
      return `Could not extract meaningful content from ${finalUrl}. The page may require JavaScript or be behind a paywall.`;
    }

    if (text.length > 4000) {
      return text.slice(0, 4000) + "\n\n[Content truncated...]";
    }

    return text;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return "Request timed out. The site may be slow or blocking automated access.";
    }
    return `Error fetching URL: ${err instanceof Error ? err.message : "Unknown error"}. Try asking me to search for information about this topic instead.`;
  }
}
