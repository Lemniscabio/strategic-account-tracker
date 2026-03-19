"use client";

import { AccountTier } from "@/lib/constants";

const TIER_STYLES: Record<AccountTier, string> = {
  A: "bg-emerald-900 text-emerald-300",
  B: "bg-blue-900 text-blue-300",
  C: "bg-gray-700 text-gray-400",
};

export default function TierBadge({ tier }: { tier: AccountTier }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${TIER_STYLES[tier]}`}>
      {tier}
    </span>
  );
}
