interface SerperResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
}

interface SerperResponse {
  organic?: SerperResult[];
  news?: SerperResult[];
}

export async function searchSerper(companyName: string): Promise<SerperResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: `"${companyName}" news OR announcement OR funding OR hiring`,
        num: 5,
      }),
    });

    if (!response.ok) return [];

    const data: SerperResponse = await response.json();
    const results = [...(data.news || []), ...(data.organic || [])];
    return results.slice(0, 5);
  } catch {
    return [];
  }
}
