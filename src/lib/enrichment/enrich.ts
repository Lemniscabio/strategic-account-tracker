import { Types } from "mongoose";
import dbConnect from "../mongodb";
import Signal from "../models/signal";
import { searchSerper } from "./serper";
import { fetchNewsRss } from "./rss";
import { categorizeSignal } from "./categorize";

interface RawSignal {
  title: string;
  url: string;
  date: string;
  source: "Serper" | "RSS";
}

function dedup(signals: RawSignal[]): RawSignal[] {
  const seen = new Map<string, RawSignal>();

  for (const signal of signals) {
    if (signal.url && seen.has(signal.url)) continue;

    const lowerTitle = signal.title.toLowerCase();
    let isDup = false;
    for (const existing of Array.from(seen.values())) {
      const existingLower = existing.title.toLowerCase();
      if (lowerTitle.includes(existingLower) || existingLower.includes(lowerTitle)) {
        isDup = true;
        break;
      }
    }
    if (isDup) continue;

    seen.set(signal.url || signal.title, signal);
  }

  return Array.from(seen.values());
}

export async function enrichAccount(accountId: string, companyName: string, keywords: string[] = []): Promise<number> {
  await dbConnect();

  const [serperResults, rssResults] = await Promise.all([
    searchSerper(companyName, keywords),
    fetchNewsRss(companyName, keywords),
  ]);

  const rawSignals: RawSignal[] = [
    ...serperResults.map((r) => ({
      title: r.title,
      url: r.link,
      date: r.date || new Date().toISOString(),
      source: "Serper" as const,
    })),
    ...rssResults.map((r) => ({
      title: r.title,
      url: r.link,
      date: r.pubDate || new Date().toISOString(),
      source: "RSS" as const,
    })),
  ];

  const deduped = dedup(rawSignals);

  const existingSignals = await Signal.find({ accountId: new Types.ObjectId(accountId) }).lean();
  const existingUrls = new Set(existingSignals.map((s) => s.url).filter(Boolean));
  const existingTitles = new Set(existingSignals.map((s) => s.title.toLowerCase()));

  const newSignals = deduped.filter((s) => {
    if (s.url && existingUrls.has(s.url)) return false;
    if (existingTitles.has(s.title.toLowerCase())) return false;
    return true;
  });

  if (newSignals.length === 0) return 0;

  const signalDocs = newSignals.map((s) => ({
    accountId: new Types.ObjectId(accountId),
    type: categorizeSignal(s.title),
    source: s.source,
    title: s.title,
    url: s.url,
    status: "Suggested",
    date: new Date(s.date),
  }));

  await Signal.insertMany(signalDocs);
  return signalDocs.length;
}
