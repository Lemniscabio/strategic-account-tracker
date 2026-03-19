"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TierBadge from "./TierBadge";
import { AccountTier } from "@/lib/constants";

interface OverdueAction {
  _id: string;
  name: string;
  tier: AccountTier;
  action: string;
  daysOverdue: number;
}

interface NewSignal {
  _id: string;
  name: string;
  tier: AccountTier;
  count: number;
  latestTitle: string;
}

interface StaleAccount {
  _id: string;
  name: string;
  tier: AccountTier;
  daysSince: number;
  lastNote: string;
}

interface FocusData {
  overdueActions: OverdueAction[];
  newSignals: NewSignal[];
  staleAccounts: StaleAccount[];
  totalItems: number;
}

export default function FocusView() {
  const router = useRouter();
  const [data, setData] = useState<FocusData | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/focus")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data || data.totalItems === 0) return null;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">🎯</span>
          <div className="text-left">
            <div className="text-sm font-semibold text-white">Today&apos;s Focus</div>
            <div className="text-xs text-gray-500">{data.totalItems} item{data.totalItems !== 1 ? "s" : ""} need your attention</div>
          </div>
        </div>
        <span className={`text-gray-500 transition-transform ${expanded ? "" : "-rotate-90"}`}>▼</span>
      </button>

      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-5 pb-5">
          {/* Overdue Actions */}
          <div className="rounded-lg border border-gray-800 bg-gray-950 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Overdue Actions
              </div>
              {data.overdueActions.length > 0 && (
                <span className="rounded-full bg-red-900/50 px-2 py-0.5 text-xs font-semibold text-red-400">
                  {data.overdueActions.length}
                </span>
              )}
            </div>
            <div className="p-2">
              {data.overdueActions.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-gray-600">All clear</div>
              ) : (
                data.overdueActions.map((item) => (
                  <div
                    key={item._id}
                    onClick={() => router.push(`/accounts/${item._id}`)}
                    className="cursor-pointer rounded-md px-3 py-2.5 hover:bg-gray-900"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-200">
                        {item.name}
                        <TierBadge tier={item.tier} />
                      </div>
                      <span className="rounded bg-red-900/50 px-2 py-0.5 text-xs font-medium text-red-400">
                        {item.daysOverdue}d overdue
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 truncate">{item.action}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* New Signals */}
          <div className="rounded-lg border border-gray-800 bg-gray-950 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
                <span className="h-2 w-2 rounded-full bg-yellow-500" />
                New Signals
              </div>
              {data.newSignals.length > 0 && (
                <span className="rounded-full bg-yellow-900/50 px-2 py-0.5 text-xs font-semibold text-yellow-400">
                  {data.newSignals.length}
                </span>
              )}
            </div>
            <div className="p-2">
              {data.newSignals.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-gray-600">All clear</div>
              ) : (
                data.newSignals.map((item) => (
                  <div
                    key={item._id}
                    onClick={() => router.push(`/accounts/${item._id}`)}
                    className="cursor-pointer rounded-md px-3 py-2.5 hover:bg-gray-900"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-200">
                        {item.name}
                        <TierBadge tier={item.tier} />
                      </div>
                      <span className="text-xs font-medium text-yellow-400">{item.count} new</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 truncate">Latest: {item.latestTitle}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Stale Accounts */}
          <div className="rounded-lg border border-gray-800 bg-gray-950 overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-300">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Stale Accounts
              </div>
              {data.staleAccounts.length > 0 && (
                <span className="rounded-full bg-blue-900/50 px-2 py-0.5 text-xs font-semibold text-blue-400">
                  {data.staleAccounts.length}
                </span>
              )}
            </div>
            <div className="p-2">
              {data.staleAccounts.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-gray-600">All clear</div>
              ) : (
                data.staleAccounts.map((item) => (
                  <div
                    key={item._id}
                    onClick={() => router.push(`/accounts/${item._id}`)}
                    className="cursor-pointer rounded-md px-3 py-2.5 hover:bg-gray-900"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-200">
                        {item.name}
                        <TierBadge tier={item.tier} />
                      </div>
                      <span className="rounded bg-blue-900/50 px-2 py-0.5 text-xs font-medium text-blue-400">
                        {item.daysSince}d no touch
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 truncate">Last: {item.lastNote}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
