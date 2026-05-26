import "server-only";
import { eq } from "drizzle-orm";
import { requireWorkspace } from "@/lib/workspace";
import { db, schema } from "../client";

export type SidebarCounts = {
  tickets: number;
  responses: number;
  customers: number;
  teamMembers: number;
};

export async function getSidebarCounts(): Promise<SidebarCounts> {
  const workspaceId = await requireWorkspace();
  const [tickets, responses, customers, teamMembers] = await Promise.all([
    db.$count(schema.tickets, eq(schema.tickets.workspaceId, workspaceId)),
    db.$count(schema.responses, eq(schema.responses.workspaceId, workspaceId)),
    db.$count(schema.customers, eq(schema.customers.workspaceId, workspaceId)),
    db.$count(
      schema.teamMembers,
      eq(schema.teamMembers.workspaceId, workspaceId),
    ),
  ]);
  return { tickets, responses, customers, teamMembers };
}
