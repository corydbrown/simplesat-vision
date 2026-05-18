import { notFound } from "next/navigation";
import { DetailDrawer } from "@/components/shared/detail-drawer";
import { CustomerDetailBody } from "@/components/customers/customer-detail";
import {
  getCustomerById,
  getCustomerTickets,
} from "@/db/queries/customers";

export default async function CustomerDrawer(
  props: PageProps<"/customers/[id]">,
) {
  const { id } = await props.params;
  const customer = await getCustomerById(id);
  if (!customer) notFound();
  const tickets = await getCustomerTickets(id, 50);

  return (
    <DetailDrawer closeHref="/customers">
      <CustomerDetailBody customer={customer} tickets={tickets} />
    </DetailDrawer>
  );
}
