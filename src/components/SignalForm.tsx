"use client";

import { useState } from "react";
import { SIGNAL_TYPES } from "@/lib/constants";

interface Props {
  accountId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function SignalForm({ accountId, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    type: "Meeting",
    title: "",
    note: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/accounts/${accountId}/signals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, date: new Date(form.date) }),
    });
    setSaving(false);
    if (!res.ok) return;
    onSaved();
  };

  const inputClass =
    "w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-blue-500 focus:outline-none";
  const labelClass = "block text-xs font-medium text-gray-400 mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-gray-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-bold text-white">Add Signal</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className={labelClass}>Signal Type *</label>
            <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {SIGNAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Title *</label>
            <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g., Met CTO at SynBioBeta" />
          </div>
          <div>
            <label className={labelClass}>Note</label>
            <textarea className={inputClass} rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Additional context..." />
          </div>
          <div>
            <label className={labelClass}>Date *</label>
            <input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving..." : "Add Signal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
