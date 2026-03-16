import { AccountType } from "@/lib/constants";

const TYPE_COLORS: Record<AccountType, string> = {
  Customer: "bg-blue-900/50 text-blue-400",
  Partner: "bg-green-900/50 text-green-400",
  Investor: "bg-purple-900/50 text-purple-400",
  Ecosystem: "bg-yellow-900/50 text-yellow-400",
};

export default function TypeBadge({ type }: { type: AccountType }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[type]}`}>
      {type}
    </span>
  );
}
