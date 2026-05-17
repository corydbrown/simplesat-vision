import "server-only";
import { db, schema } from "../client";

export type SidebarCounts = {
  tickets: number;
  responses: number;
  customers: number;
  teamMembers: number;
};

export async function getSidebarCounts(): Promise<SidebarCounts> {
  const [tickets, responses, customers, teamMembers] = await Promise.all([
    db.$count(schema.tickets),
    db.$count(schema.responses),
    db.$count(schema.customers),
    db.$count(schema.teamMembers),
  ]);
  return { tickets, responses, customers, teamMembers };
}
