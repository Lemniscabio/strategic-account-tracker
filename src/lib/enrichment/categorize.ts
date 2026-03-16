import { SignalType } from "../constants";

const KEYWORD_MAP: { type: SignalType; keywords: string[] }[] = [
  { type: "Hiring", keywords: ["hired", "hiring", "job", "recruit", "appoint"] },
  { type: "Funding", keywords: ["raised", "funding", "series", "round", "investment", "capital"] },
  { type: "Partnership", keywords: ["partner", "partnership", "collaborate", "alliance", "joint"] },
  { type: "Expansion", keywords: ["expand", "facility", "new site", "scale", "capacity"] },
  { type: "Product Launch", keywords: ["launch", "release", "announce product", "unveil"] },
  { type: "Regulatory Approval", keywords: ["fda", "ema", "approved", "clearance", "regulatory"] },
  { type: "Scale-up Announcement", keywords: ["scale-up", "scale up", "production ramp"] },
];

export function categorizeSignal(title: string): SignalType {
  const lower = title.toLowerCase();
  for (const { type, keywords } of KEYWORD_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return type;
    }
  }
  return "News";
}
