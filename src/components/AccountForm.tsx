"use client";

import { useState } from "react";
import { ACCOUNT_TYPES, STAGES } from "@/lib/constants";

interface Props {
  account?: {
    _id: string;
    name: string;
    type: string;
    stage: string;
    website?: string;
    linkedinUrl?: string;
    opportunityHypothesis: string;
    founderNote?: string;
    nextAction?: string;
    nextActionDate?: string;
  };
  onClose: () => void;
  onSaved: () => void;
}

export default function AccountForm({ account, onClose, onSaved }: Props) {
  const isEdit = !!account;
  const [form, setForm] = useState({
    name: account?.name || "",
    type: account?.type || "Customer",
    stage: account?.stage || "Identified",
    website: account?.website || "",
    linkedinUrl: account?.linkedinUrl || "",
    opportunityHypothesis: account?.opportunityHypothesis || "",
    founderNote: account?.founderNote || "",
    nextAction: account?.nextAction || "",
    nextActionDate: account?.nextActionDate?.split("T")[0] || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const url = isEdit ? `/api/accounts/${account._id}` : "/api/accounts";
    const method = isEdit ? "PUT" : "POST";

    const body = {
      ...form,
      nextActionDate: form.nextActionDate || undefined,
    };

    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);

    if (!res.ok) {
      setError("Failed to save account. Please try again.");
      return;
    }

    onSaved();
  };

  const inputClass =
    "w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none";
  const labelClass = "block text-xs font-medium text-gray-400 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-gray-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold text-white">{isEdit ? "Edit Account" : "Add Account"}</h2>
        {error && <div className="mb-3 rounded-lg bg-red-900/50 px-3 py-2 text-sm text-red-400">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelClass}>Company Name *</label>
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Type *</label>
              <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Stage *</label>
              <select className={inputClass} value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Opportunity Hypothesis *</label>
            <textarea className={inputClass} rows={2} value={form.opportunityHypothesis} onChange={(e) => setForm({ ...form, opportunityHypothesis: e.target.value })} required />
          </div>
          <div>
            <label className={labelClass}>Founder Note</label>
            <textarea className={inputClass} rows={2} value={form.founderNote} onChange={(e) => setForm({ ...form, founderNote: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Website</label>
              <input className={inputClass} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" />
            </div>
            <div>
              <label className={labelClass}>LinkedIn URL</label>
              <input className={inputClass} value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/company/..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Next Action</label>
              <input className={inputClass} value={form.nextAction} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Action Due Date</label>
              <input type="date" className={inputClass} value={form.nextActionDate} onChange={(e) => setForm({ ...form, nextActionDate: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving..." : isEdit ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
