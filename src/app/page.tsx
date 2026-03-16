import KpiCards from "@/components/KpiCards";
import AccountTable from "@/components/AccountTable";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <KpiCards />
      <AccountTable />
    </div>
  );
}
