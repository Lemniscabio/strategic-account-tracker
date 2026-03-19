"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import StageBadge from "@/components/StageBadge";
import TierBadge from "@/components/TierBadge";
import TypeBadge from "@/components/TypeBadge";
import SignalTimeline from "@/components/SignalTimeline";
import SignalForm from "@/components/SignalForm";
import TouchpointForm from "@/components/TouchpointForm";
import TouchpointTimeline from "@/components/TouchpointTimeline";
import AccountForm from "@/components/AccountForm";
import Toast from "@/components/Toast";
import KeywordChips from "@/components/KeywordChips";
import AiChatButton from "@/components/AiChatButton";
import AiChat from "@/components/AiChat";
import { AccountType, AccountTier, Stage } from "@/lib/constants";

interface Account {
  _id: string;
  name: string;
  type: AccountType;
  stage: Stage;
  website?: string;
  linkedinUrl?: string;
  opportunityHypothesis: string;
  founderNote?: string;
  nextAction?: string;
  nextActionDate?: string;
  lastTouchpoint?: string;
  tier: AccountTier;
  touchpoints?: { date: string; note: string; outcome: string }[];
  keywords?: string[];
}

interface Signal {
  _id: string;
  type: string;
  source: string;
  title: string;
  note?: string;
  url?: string;
  status: string;
  date: string;
  relevanceScore?: number;
  scoreReason?: string;
  snippet?: string;
}

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [showSignalForm, setShowSignalForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showTouchpointForm, setShowTouchpointForm] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const fetchAccount = useCallback(async () => {
    const res = await fetch(`/api/accounts/${id}`);
    if (!res.ok) return router.push("/");
    setAccount(await res.json());
  }, [id, router]);

  const fetchSignals = useCallback(async () => {
    const res = await fetch(`/api/accounts/${id}/signals`);
    setSignals(await res.json());
  }, [id]);

  useEffect(() => {
    fetchAccount();
    fetchSignals();
  }, [fetchAccount, fetchSignals]);

  const handleConfirm = async (signalId: string) => {
    await fetch(`/api/signals/${signalId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Confirmed" }),
    });
    fetchSignals();
    fetchAccount();
  };

  const handleDismiss = async (signalId: string) => {
    await fetch(`/api/signals/${signalId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Dismissed" }),
    });
    fetchSignals();
  };

  const handleDelete = async (signalId: string) => {
    await fetch(`/api/signals/${signalId}`, { method: "DELETE" });
    fetchSignals();
  };

  const handleEnrich = async () => {
    setEnriching(true);
    try {
      const res = await fetch(`/api/accounts/${id}/enrich`, { method: "POST" });
      const data = await res.json();
      if (data.newSignals > 0) {
        setToast({
          message: `Found ${data.newSignals} signal(s), scored ${data.scored}, dismissed ${data.dismissed}`,
          type: "success",
        });
      } else {
        setToast({ message: "No new signals found", type: "info" });
      }
      fetchSignals();
    } catch {
      setToast({ message: "Enrichment unavailable", type: "error" });
    }
    setEnriching(false);
  };

  const handleAddKeyword = async (keyword: string) => {
    if (!account) return;
    const existing = account.keywords || [];
    if (existing.includes(keyword)) return;
    const updated = [...existing, keyword];
    await fetch(`/api/accounts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: updated }),
    });
    await fetchAccount();
    handleEnrich();
  };

  const handleRemoveKeyword = async (keyword: string) => {
    if (!account) return;
    const updated = (account.keywords || []).filter((k) => k !== keyword);
    await fetch(`/api/accounts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: updated }),
    });
    fetchAccount();
  };

  const handleRescore = async () => {
    setEnriching(true);
    try {
      const res = await fetch(`/api/accounts/${id}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rescore: true }),
      });
      const data = await res.json();
      setToast({ message: `Re-scored ${data.scored} signal(s), dismissed ${data.dismissed}`, type: "success" });
      fetchSignals();
    } catch {
      setToast({ message: "Scoring failed", type: "error" });
    }
    setEnriching(false);
  };

  if (!account) return <div className="py-12 text-center text-gray-500">Loading...</div>;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <button onClick={() => router.push("/")} className="text-sm text-blue-400 hover:text-blue-300">
            ← Back to accounts
          </button>
          <h2 className="mt-2 text-2xl font-bold text-white">{account.name}</h2>
          <div className="mt-2 flex gap-2">
            <TypeBadge type={account.type} />
            <StageBadge stage={account.stage} />
            <TierBadge tier={account.tier || "C"} />
          </div>
        </div>
        <div className="flex gap-2">
          <AiChatButton onClick={() => setShowChat(true)} />
          <button
            onClick={() => setShowEditForm(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Edit
          </button>
          <button
            onClick={handleEnrich}
            disabled={enriching}
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50"
          >
            {enriching ? "Refreshing & Scoring..." : "Refresh Signals"}
          </button>
          <button
            onClick={handleRescore}
            disabled={enriching}
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 disabled:opacity-50"
          >
            Re-score
          </button>
          <button
            onClick={async () => {
              if (!confirm("Delete this account? This cannot be undone.")) return;
              await fetch(`/api/accounts/${id}`, { method: "DELETE" });
              router.push("/");
            }}
            className="rounded-lg bg-red-900/50 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-900"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left: Account context */}
        <div className="space-y-4">
          <div className="rounded-lg bg-gray-900 p-4">
            <div className="text-xs font-medium text-gray-500">OPPORTUNITY HYPOTHESIS</div>
            <div className="mt-2 text-sm text-gray-300">{account.opportunityHypothesis}</div>
          </div>

          {account.founderNote && (
            <div className="rounded-lg bg-gray-900 p-4">
              <div className="text-xs font-medium text-gray-500">FOUNDER NOTE</div>
              <div className="mt-2 text-sm text-gray-300">{account.founderNote}</div>
            </div>
          )}

          <KeywordChips
            keywords={account.keywords || []}
            onAdd={handleAddKeyword}
            onRemove={handleRemoveKeyword}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-gray-900 p-4">
              <div className="text-xs font-medium text-gray-500">NEXT ACTION</div>
              <div className="mt-2 text-sm text-yellow-400">{account.nextAction || "—"}</div>
              {account.nextActionDate && (
                <div className="mt-1 text-xs text-gray-500">
                  Due: {new Date(account.nextActionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              )}
            </div>
            <div className="rounded-lg bg-gray-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-medium text-gray-500">TOUCHPOINTS</div>
                <button
                  onClick={() => setShowTouchpointForm(true)}
                  className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                >
                  + Add
                </button>
              </div>
              <TouchpointTimeline touchpoints={account.touchpoints || []} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {account.website && (
              <div className="rounded-lg bg-gray-900 p-4">
                <div className="text-xs font-medium text-gray-500">WEBSITE</div>
                <a href={account.website} target="_blank" rel="noopener noreferrer" className="mt-2 block text-sm text-blue-400 hover:text-blue-300 truncate">
                  {account.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
            {account.linkedinUrl && (
              <div className="rounded-lg bg-gray-900 p-4">
                <div className="text-xs font-medium text-gray-500">LINKEDIN</div>
                <a href={account.linkedinUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block text-sm text-blue-400 hover:text-blue-300 truncate">
                  LinkedIn →
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Right: Signal Timeline */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Signal Timeline</h3>
            <button
              onClick={() => setShowSignalForm(true)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              + Add Signal
            </button>
          </div>
          <SignalTimeline signals={signals} onConfirm={handleConfirm} onDismiss={handleDismiss} onDelete={handleDelete} />
        </div>
      </div>

      {/* Modals */}
      {showSignalForm && (
        <SignalForm
          accountId={id}
          onClose={() => setShowSignalForm(false)}
          onSaved={() => { setShowSignalForm(false); fetchSignals(); fetchAccount(); }}
        />
      )}
      {showTouchpointForm && (
        <TouchpointForm
          accountId={id}
          onClose={() => setShowTouchpointForm(false)}
          onSaved={() => { setShowTouchpointForm(false); fetchAccount(); }}
        />
      )}
      {showEditForm && (
        <AccountForm
          account={account}
          onClose={() => setShowEditForm(false)}
          onSaved={() => { setShowEditForm(false); fetchAccount(); }}
        />
      )}

      {/* AI Chat */}
      {showChat && (
        <AiChat
          accountId={id}
          onClose={() => setShowChat(false)}
          onKeywordsAccepted={async (newKeywords) => {
            if (!account) return;
            const existing = account.keywords || [];
            const unique = newKeywords.filter((kw) => !existing.includes(kw));
            if (unique.length === 0) return;
            const updated = [...existing, ...unique];
            await fetch(`/api/accounts/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ keywords: updated }),
            });
            await fetchAccount();
            handleEnrich();
          }}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
