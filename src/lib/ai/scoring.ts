import { generateJSON } from "./gemini";

interface AccountContext {
  name: string;
  type: string;
  stage: string;
  opportunityHypothesis: string;
  keywords: string[];
}

interface SignalInput {
  _id: string;
  title: string;
  snippet: string;
  source: string;
  type: string;
  date: string;
}

interface ScoreResult {
  signalId: string;
  score: number;
  reason: string;
}

const BATCH_SIZE = 20;

function buildScoringPrompt(account: AccountContext, signals: SignalInput[]): string {
  const signalList = signals
    .map((s, i) => {
      let entry = `${i + 1}. [ID: ${s._id}] "${s.title}" (${s.type}, ${s.source}, ${new Date(s.date).toLocaleDateString()})`;
      if (s.snippet) entry += `\n   Content: ${s.snippet}`;
      return entry;
    })
    .join("\n");

  return `Score each signal for relevance to this account tracked by a biomanufacturing/CDMO-focused investment firm. Use the content snippet (when available) to judge actual relevance — don't score based on title alone.

Account: ${account.name} (${account.type}, stage: ${account.stage})
Opportunity Hypothesis: ${account.opportunityHypothesis}
${account.keywords.length > 0 ? `Keywords: ${account.keywords.join(", ")}` : ""}

Signals:
${signalList}

Score 1-5:
5 = Directly actionable for investment/partnership decision
4 = Highly relevant to account strategy
3 = Moderately relevant, worth reviewing
2 = Tangentially related
1 = Irrelevant noise

Return a JSON array: [{"signalId": "<the ID>", "score": <1-5>, "reason": "one-line explanation"}]
Only return the JSON array, nothing else.`;
}

export async function scoreSignals(
  account: AccountContext,
  signals: SignalInput[]
): Promise<ScoreResult[]> {
  if (signals.length === 0) return [];

  const allResults: ScoreResult[] = [];

  for (let i = 0; i < signals.length; i += BATCH_SIZE) {
    const batch = signals.slice(i, i + BATCH_SIZE);
    const prompt = buildScoringPrompt(account, batch);

    try {
      const results = await generateJSON<ScoreResult[]>(prompt);

      if (!Array.isArray(results)) continue;

      const validSignalIds = new Set(batch.map((s) => s._id));
      for (const r of results) {
        if (!validSignalIds.has(r.signalId)) continue;
        r.score = Math.max(1, Math.min(5, Math.round(r.score)));
        r.reason = r.reason || "";
        allResults.push(r);
      }
    } catch (err) {
      try {
        const results = await generateJSON<ScoreResult[]>(prompt);
        if (Array.isArray(results)) {
          const validSignalIds = new Set(batch.map((s) => s._id));
          for (const r of results) {
            if (!validSignalIds.has(r.signalId)) continue;
            r.score = Math.max(1, Math.min(5, Math.round(r.score)));
            r.reason = r.reason || "";
            allResults.push(r);
          }
        }
      } catch {
        console.error("Scoring failed for batch, skipping:", err);
      }
    }
  }

  return allResults;
}
