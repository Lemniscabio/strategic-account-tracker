import KpiCards from "@/components/KpiCards";
import AccountTable from "@/components/AccountTable";
import FocusView from "@/components/FocusView";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <KpiCards />
      <FocusView />
      <AccountTable />
    </div>
  );
}
