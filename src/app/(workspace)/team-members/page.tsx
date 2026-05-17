import { ComingSoonPage } from "@/components/shell/coming-soon";

export default function TeamMembersPage() {
  return (
    <ComingSoonPage
      crumbs={[{ label: "Team members" }]}
      title="Team members"
      description="Agent roster with performance, QA scores, and assignment context."
    />
  );
}
