"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AccountForm from "./AccountForm";

export default function Header() {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <header className="border-b border-gray-800 bg-gray-950 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <h1 className="text-xl font-bold text-white">Strategic Account Tracker</h1>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add Account
          </button>
        </div>
      </header>
      {showForm && (
        <AccountForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
