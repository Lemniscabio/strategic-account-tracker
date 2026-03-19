"use client";

interface Touchpoint {
  date: string;
  note: string;
  outcome: string;
}

interface Props {
  touchpoints: Touchpoint[];
}

export default function TouchpointTimeline({ touchpoints }: Props) {
  const sorted = [...touchpoints].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (sorted.length === 0) {
    return <div className="text-sm text-gray-500">No touchpoints yet</div>;
  }

  return (
    <div className="relative space-y-0">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-700" />
      {sorted.map((tp, i) => (
        <div key={i} className="relative flex gap-3 pb-4">
          <div className="relative z-10 mt-1.5 h-[14px] w-[14px] flex-shrink-0 rounded-full border-2 border-blue-500 bg-gray-900" />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-gray-300">
              {new Date(tp.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </div>
            <div className="mt-0.5 text-sm text-gray-400">{tp.note}</div>
            {tp.outcome && (
              <div className="mt-0.5 text-xs text-gray-500 italic">→ {tp.outcome}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
