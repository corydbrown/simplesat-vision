import { ComingSoonPage } from "@/components/shell/coming-soon";

export default function CustomersPage() {
  return (
    <ComingSoonPage
      crumbs={[{ label: "Customers" }]}
      title="Customers"
      description="Every customer, with their feedback history and account context."
    />
  );
}
