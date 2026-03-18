"use client";

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

interface Props {
  signals: Signal[];
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function SignalTimeline({ signals, onConfirm, onDismiss, onDelete }: Props) {
  if (signals.length === 0) {
    return <div className="py-8 text-center text-sm text-gray-500">No signals yet</div>;
  }

  return (
    <div className="border-l-2 border-gray-800 pl-4 space-y-4">
      {signals.map((signal) => (
        <div key={signal._id} className={`relative ${signal.status === "Suggested" ? "rounded-lg border border-yellow-800/50 bg-yellow-900/10 p-3" : ""}`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-gray-500">
                {new Date(signal.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {" · "}
                <span className={signal.status === "Confirmed" ? "text-green-400" : "text-yellow-400"}>
                  {signal.status}
                </span>
                {signal.relevanceScore != null && (
                  <span
                    className={`ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-bold ${
                      signal.relevanceScore >= 4
                        ? "bg-green-900/50 text-green-400"
                        : signal.relevanceScore >= 3
                          ? "bg-blue-900/50 text-blue-400"
                          : "bg-gray-800 text-gray-500"
                    }`}
                    title={signal.scoreReason || ""}
                  >
                    {signal.relevanceScore}/5
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm text-white">
                {signal.url ? (
                  <a href={signal.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400">
                    {signal.title}
                  </a>
                ) : (
                  signal.title
                )}
              </div>
              <div className="mt-0.5 text-xs text-gray-500">
                Type: {signal.type} · Source: {signal.source}
              </div>
              {signal.snippet && (
                <div className="mt-1 text-xs text-gray-500 line-clamp-2">{signal.snippet}</div>
              )}
              {signal.note && <div className="mt-1 text-xs text-gray-400">{signal.note}</div>}
            </div>
            <div className="flex items-center gap-1 ml-2">
              {signal.status === "Suggested" && (
                <>
                  <button
                    onClick={() => onConfirm(signal._id)}
                    className="rounded bg-green-900/50 px-2 py-1 text-xs text-green-400 hover:bg-green-900"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => onDismiss(signal._id)}
                    className="rounded bg-red-900/50 px-2 py-1 text-xs text-red-400 hover:bg-red-900"
                  >
                    Dismiss
                  </button>
                </>
              )}
              {signal.source === "Manual" && (
                <button
                  onClick={() => onDelete(signal._id)}
                  className="rounded px-2 py-1 text-xs text-gray-500 hover:text-red-400"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
