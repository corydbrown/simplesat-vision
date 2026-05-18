import { NextResponse } from "next/server";
import { getCustomerById } from "@/db/queries/customers";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    id: customer.id,
    name: customer.name,
    email: customer.email,
    company: customer.company,
    tier: customer.tier,
    totalTickets: customer.stats.totalTickets,
    avgRating: customer.stats.avgRating,
    totalResponses: customer.stats.totalResponses,
    lastSeen:
      customer.stats.lastSeen != null
        ? customer.stats.lastSeen.toISOString()
        : null,
  });
}
