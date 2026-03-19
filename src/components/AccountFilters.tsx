"use client";

import { ACCOUNT_TYPES, STAGES, ACCOUNT_TIERS } from "@/lib/constants";

interface Props {
  search: string;
  type: string;
  stage: string;
  tier: string;
  onSearchChange: (v: string) => void;
  onTypeChange: (v: string) => void;
  onStageChange: (v: string) => void;
  onTierChange: (v: string) => void;
}

export default function AccountFilters({ search, type, stage, tier, onSearchChange, onTypeChange, onStageChange, onTierChange }: Props) {
  const selectClass =
    "rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:border-blue-500 focus:outline-none";

  return (
    <div className="flex items-center gap-3">
      <input
        type="text"
        placeholder="Search accounts..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
      />
      <select value={stage} onChange={(e) => onStageChange(e.target.value)} className={selectClass}>
        <option value="">All Stages</option>
        {STAGES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select value={type} onChange={(e) => onTypeChange(e.target.value)} className={selectClass}>
        <option value="">All Types</option>
        {ACCOUNT_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <select value={tier} onChange={(e) => onTierChange(e.target.value)} className={selectClass}>
        <option value="">All Tiers</option>
        {ACCOUNT_TIERS.map((t) => (
          <option key={t} value={t}>Tier {t}</option>
        ))}
      </select>
    </div>
  );
}
