interface RssItem {
  title: string;
  link: string;
  pubDate: string;
}

export async function fetchNewsRss(companyName: string): Promise<RssItem[]> {
  try {
    const query = encodeURIComponent(companyName);
    const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

    const response = await fetch(url);
    if (!response.ok) return [];

    const xml = await response.text();

    const items: RssItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
      const itemXml = match[1];
      const title = itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1") || "";
      const link = itemXml.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "";
      const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "";

      if (title && link) {
        items.push({ title, link, pubDate });
      }
    }

    return items;
  } catch {
    return [];
  }
}
