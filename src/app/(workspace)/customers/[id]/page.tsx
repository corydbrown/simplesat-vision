import { notFound } from "next/navigation";
import { Topbar } from "@/components/shell/topbar";
import { CustomerDetailBody } from "@/components/customers/customer-detail";
import { DetailActions } from "@/components/shared/detail-actions";
import {
  getCustomerById,
  getCustomerResponses,
  getCustomerTickets,
} from "@/db/queries/customers";
import type { CustomerListRow } from "@/db/queries/customers";

export default async function CustomerDetailPage(
  props: PageProps<"/customers/[id]">,
) {
  const { id } = await props.params;

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
    organization: customer.organization,
    organizationExternalId: customer.organizationExternalId,
    organizationDomain: customer.organizationDomain,
    language: customer.language,
    tier: customer.tier,
    customProperties: customer.customProperties,
    totalTickets: customer.stats.totalTickets,
    avgRating: customer.stats.avgRating,
    lastSeen: customer.stats.lastSeen,
  };

  return (
    <>
      <Topbar
        crumbs={[
          { label: "Customers", href: "/customers" },
          { label: customer.name },
        ]}
        actions={<DetailActions entityHref={`/customers/${customer.id}`} />}
      />
      <CustomerDetailBody
        customer={customer}
        customerRow={customerRow}
        tickets={tickets}
        responses={responses}
      />
    </>
  );
}
