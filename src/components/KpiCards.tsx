"use client";

import { useEffect, useState } from "react";

interface Stats {
  totalAccounts: number;
  activePilots: number;
  pendingActions: number;
  newSignals: number;
}

export default function KpiCards() {
  const [stats, setStats] = useState<Stats>({ totalAccounts: 0, activePilots: 0, pendingActions: 0, newSignals: 0 });

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const cards = [
    { label: "ACCOUNTS", value: stats.totalAccounts, color: "text-white" },
    { label: "ACTIVE PILOTS", value: stats.activePilots, color: "text-emerald-400" },
    { label: "PENDING ACTIONS", value: stats.pendingActions, color: "text-yellow-400" },
    { label: "NEW SIGNALS", value: stats.newSignals, color: "text-red-400" },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg bg-gray-900 p-4">
          <div className="text-xs text-gray-500">{card.label}</div>
          <div className={`mt-1 text-2xl font-bold ${card.color}`}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}
