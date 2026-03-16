"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountType, Stage } from "@/lib/constants";
import StageBadge from "./StageBadge";
import TypeBadge from "./TypeBadge";
import AccountFilters from "./AccountFilters";

interface AccountRow {
  _id: string;
  name: string;
  type: AccountType;
  stage: Stage;
  nextAction?: string;
  nextActionDate?: string;
  latestSignal?: { title: string; date: string } | null;
}

export default function AccountTable() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [stage, setStage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (type) params.set("type", type);
    if (stage) params.set("stage", stage);

    setLoading(true);
    fetch(`/api/accounts?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setAccounts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [search, type, stage]);

  return (
    <div className="space-y-4">
      <AccountFilters
        search={search}
        type={type}
        stage={stage}
        onSearchChange={setSearch}
        onTypeChange={setType}
        onStageChange={setStage}
      />

      {loading ? (
        <div className="py-12 text-center text-gray-500">Loading...</div>
      ) : accounts.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          No accounts yet — add your first strategic account
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-800">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50 text-left text-xs text-gray-500">
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Latest Signal</th>
                <th className="px-4 py-3">Next Action</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr
                  key={account._id}
                  onClick={() => router.push(`/accounts/${account._id}`)}
                  className="cursor-pointer border-b border-gray-800/50 hover:bg-gray-900/30"
                >
                  <td className="px-4 py-3 font-medium text-blue-400">{account.name}</td>
                  <td className="px-4 py-3">
                    <TypeBadge type={account.type} />
                  </td>
                  <td className="px-4 py-3">
                    <StageBadge stage={account.stage} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {account.latestSignal ? (
                      <>
                        {account.latestSignal.title}
                        <span className="ml-2 text-gray-600">
                          {new Date(account.latestSignal.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-yellow-400">
                    {account.nextAction || <span className="text-gray-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
