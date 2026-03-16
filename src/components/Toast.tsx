"use client";

import { useEffect } from "react";

interface Props {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
}

export default function Toast({ message, type = "info", onClose }: Props) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: "bg-green-900/80 text-green-300 border-green-700",
    error: "bg-red-900/80 text-red-300 border-red-700",
    info: "bg-gray-800 text-gray-300 border-gray-700",
  };

  return (
    <div className={`fixed bottom-4 right-4 z-50 rounded-lg border px-4 py-3 text-sm shadow-lg ${colors[type]}`}>
      {message}
    </div>
  );
}
