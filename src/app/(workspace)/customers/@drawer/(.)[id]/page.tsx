import { notFound } from "next/navigation";
import { DetailDrawer } from "@/components/shared/detail-drawer";
import { CustomerDetailBody } from "@/components/customers/customer-detail";
import {
  getCustomerById,
  getCustomerResponses,
  getCustomerTickets,
} from "@/db/queries/customers";
import type { CustomerListRow } from "@/db/queries/customers";

type Tab = "tickets" | "responses";

export default async function CustomerDrawer(
  props: PageProps<"/customers/[id]">,
) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const tab: Tab = sp.tab === "responses" ? "responses" : "tickets";

  const customer = await getCustomerById(id);
  if (!customer) notFound();
  const [tickets, responses] = await Promise.all([
    getCustomerTickets(id, 50),
    getCustomerResponses(id, 50),
  ]);

  const customerRow: CustomerListRow = {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    company: customer.company,
    tier: customer.tier,
    totalTickets: customer.stats.totalTickets,
    avgRating: customer.stats.avgRating,
    lastSeen: customer.stats.lastSeen,
  };

  return (
    <DetailDrawer closeHref="/customers">
      <CustomerDetailBody
        customer={customer}
        customerRow={customerRow}
        tickets={tickets}
        responses={responses}
        tab={tab}
      />
    </DetailDrawer>
  );
}
