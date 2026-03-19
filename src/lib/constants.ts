export const ACCOUNT_TYPES = ["Customer", "Partner", "Investor", "Ecosystem"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TIERS = ['A', 'B', 'C'] as const;
export type AccountTier = (typeof ACCOUNT_TIERS)[number];

export const STAGES = [
  "Identified",
  "Researching",
  "Engaged",
  "Pilot Discussion",
  "Active Pilot",
  "Customer/Partner",
  "Churned",
] as const;
export type Stage = (typeof STAGES)[number];

export const SIGNAL_TYPES = [
  "Hiring",
  "Funding",
  "Partnership",
  "Product Launch",
  "Expansion",
  "News",
  "Regulatory Approval",
  "Scale-up Announcement",
  "Meeting",
  "Email",
  "Other",
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];

export const SIGNAL_SOURCES = ["Manual", "Serper", "RSS", "Tavily"] as const;
export type SignalSource = (typeof SIGNAL_SOURCES)[number];

export const SIGNAL_STATUSES = ["Confirmed", "Suggested", "Dismissed"] as const;
export type SignalStatus = (typeof SIGNAL_STATUSES)[number];

export const TOUCHPOINT_TYPES: SignalType[] = ["Meeting", "Email"];
