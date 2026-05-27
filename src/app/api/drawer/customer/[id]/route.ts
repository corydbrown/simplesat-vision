import { NextResponse } from "next/server";
import {
  getCustomerById,
  getCustomerResponses,
  getCustomerTickets,
  type CustomerListRow,
} from "@/db/queries/customers";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const [tickets, responses] = await Promise.all([
    getCustomerTickets(id, 50),
    getCustomerResponses(id, 50),
  ]);

  const customerRow: CustomerListRow = {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    avatarUrl: customer.avatarUrl,
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

  return NextResponse.json({ customer, customerRow, tickets, responses });
}
