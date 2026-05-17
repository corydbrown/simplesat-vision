import { ComingSoonPage } from "@/components/shell/coming-soon";

export default function ReportsPage() {
  return (
    <ComingSoonPage
      crumbs={[{ label: "Reports" }]}
      title="Reports"
      description="Customizable dashboards, CSAT/NPS/CES trends, agent leaderboards."
    />
  );
}
