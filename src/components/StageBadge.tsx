import { Stage } from "@/lib/constants";

const STAGE_COLORS: Record<Stage, string> = {
  Identified: "bg-gray-800 text-gray-300",
  Researching: "bg-indigo-900/50 text-indigo-400",
  Engaged: "bg-yellow-900/50 text-yellow-400",
  "Pilot Discussion": "bg-green-900/50 text-green-400",
  "Active Pilot": "bg-emerald-900/50 text-emerald-400",
  "Customer/Partner": "bg-blue-900/50 text-blue-400",
  Churned: "bg-red-900/50 text-red-400",
};

export default function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[stage]}`}>
      {stage}
    </span>
  );
}
