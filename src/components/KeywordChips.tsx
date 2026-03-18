"use client";

import { useState } from "react";

interface Props {
  keywords: string[];
  onAdd: (keyword: string) => void;
  onRemove: (keyword: string) => void;
}

export default function KeywordChips({ keywords, onAdd, onRemove }: Props) {
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const kw = input.trim().toLowerCase();
    if (kw && !keywords.includes(kw)) {
      onAdd(kw);
      setInput("");
    }
  };

  return (
    <div className="rounded-lg bg-gray-900 p-4">
      <div className="text-xs font-medium text-gray-500 mb-2">KEYWORDS</div>
      <div className="flex flex-wrap gap-2 mb-2">
        {keywords.map((kw) => (
          <span
            key={kw}
            className="inline-flex items-center gap-1 rounded-full bg-blue-900/40 px-3 py-1 text-xs text-blue-300"
          >
            {kw}
            <button
              onClick={() => onRemove(kw)}
              className="ml-1 text-blue-400 hover:text-red-400"
            >
              ×
            </button>
          </span>
        ))}
        {keywords.length === 0 && (
          <span className="text-xs text-gray-600">No keywords — using default search</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add keyword..."
          className="flex-1 rounded bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-600 outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          onClick={handleAdd}
          disabled={!input.trim()}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}
