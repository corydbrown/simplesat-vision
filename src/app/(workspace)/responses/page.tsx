import { ComingSoonPage } from "@/components/shell/coming-soon";

export default function ResponsesPage() {
  return (
    <ComingSoonPage
      crumbs={[{ label: "Responses" }]}
      title="Responses"
      description="Every survey response, joined to ticket and agent."
    />
  );
}
