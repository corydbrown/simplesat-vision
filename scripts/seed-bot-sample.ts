/**
 * SVP-199 verification sample. `db:seed` is broken repo-wide (SVP-179 in
 * flight), so this is a tiny self-contained seed path that makes the new
 * AI-bot identity seam visible end-to-end without the full Bloom Beauty
 * dataset. It (idempotently) creates one customer + one team member + one
 * ticket with:
 *   - a customer opening turn
 *   - a public BOT turn (authorRole "agent" + authorSubtype "bot", no
 *     teamMemberId) → the activity timeline renders the distinct Bot chip
 *   - a human follow-up turn (the hybrid handoff shape)
 * and flips the ticket's conversation-level AI flags to a hybrid shape.
 *
 * Fixed ids + `onConflictDoUpdate` make every run upsert the same rows rather
 * than piling up. The PRODUCTION path is the ingest API (`upsertMessage` /
 * `upsertTicket` set exactly these fields from n8n) — this writes the DB
 * directly only because the seed pipeline is down. Safe to delete once
 * db:seed is restored.
 *
 * Run: `set -a && source .env.local && set +a && tsx --conditions=react-server scripts/seed-bot-sample.ts`
 */
import { eq } from "drizzle-orm";

import { db } from "../src/db/client";
import {
  customers,
  teamMembers,
  ticketMessages,
  tickets,
  workspaces,
} from "../src/db/schema";
import { DEMO_WORKSPACE_ID } from "../src/lib/workspace-id";

const CUSTOMER_ID = "cus_svp199_sample";
const TEAM_MEMBER_ID = "tm_svp199_sample";
const TICKET_ID = "tkt_svp199_sample";
const T0 = new Date("2026-05-20T09:00:00Z").getTime();

async function main() {
  const [ws] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, DEMO_WORKSPACE_ID))
    .limit(1);
  if (!ws) {
    throw new Error(
      `Workspace ${DEMO_WORKSPACE_ID} missing — run db:migrate first.`,
    );
  }

  await db
    .insert(customers)
    .values({
      id: CUSTOMER_ID,
      workspaceId: DEMO_WORKSPACE_ID,
      name: "Maya Chen",
      email: "maya.chen+svp199@example.com",
      tier: "gold",
    })
    .onConflictDoUpdate({
      target: customers.id,
      set: { name: "Maya Chen", tier: "gold" },
    });

  await db
    .insert(teamMembers)
    .values({
      id: TEAM_MEMBER_ID,
      workspaceId: DEMO_WORKSPACE_ID,
      name: "Priya Nair",
      email: "priya.nair+svp199@example.com",
      role: "Beauty Advisor",
      team: "Front line",
      avatarColor: "#6366f1",
    })
    .onConflictDoUpdate({
      target: teamMembers.id,
      set: { name: "Priya Nair", role: "Beauty Advisor" },
    });

  const ticketValues = {
    workspaceId: DEMO_WORKSPACE_ID,
    subject: "Where is my order? (SVP-199 sample)",
    status: "solved",
    channel: "chat" as const,
    source: "intercom",
    priority: "normal" as const,
    customerId: CUSTOMER_ID,
    teamMemberId: TEAM_MEMBER_ID,
    createdAt: new Date(T0),
    solvedAt: new Date(T0 + 30 * 60_000),
    closedAt: new Date(T0 + 30 * 60_000),
    // Hybrid AI-handling shape: bot started, then a human took over.
    aiAgentParticipated: true,
    startedWithBot: true,
    handedOffToHuman: true,
    aiResolutionState: "routed_to_team",
  };
  await db
    .insert(tickets)
    .values({ id: TICKET_ID, ...ticketValues })
    .onConflictDoUpdate({ target: tickets.id, set: ticketValues });

  const turns = [
    {
      id: "tkm_svp199_customer",
      authorRole: "customer" as const,
      authorSubtype: null,
      customerId: CUSTOMER_ID,
      teamMemberId: null,
      body: "Hi, my order #BLM-48217 was supposed to arrive yesterday and it still hasn't shown up. Can you check?",
      at: T0,
    },
    {
      id: "tkm_svp199_bot",
      authorRole: "agent" as const,
      authorSubtype: "bot" as const,
      customerId: null,
      teamMemberId: null,
      body: "Hi! I'm Bloom's AI assistant. I can see order #BLM-48217 shipped on the 18th and is currently in transit. Tracking shows a one-day carrier delay. I've flagged a teammate to confirm the new delivery window for you.",
      at: T0 + 2 * 60_000,
    },
    {
      id: "tkm_svp199_human",
      authorRole: "agent" as const,
      authorSubtype: "human" as const,
      customerId: null,
      teamMemberId: TEAM_MEMBER_ID,
      body: "Hi Maya, Priya here. I checked with the carrier — your order is now out for delivery and should arrive today by 6pm. Sorry for the delay! I've added a 10% loyalty credit to your account for the trouble.",
      at: T0 + 12 * 60_000,
    },
  ];

  for (const turn of turns) {
    const values = {
      ticketId: TICKET_ID,
      authorRole: turn.authorRole,
      authorSubtype: turn.authorSubtype,
      customerId: turn.customerId,
      teamMemberId: turn.teamMemberId,
      channel: "chat" as const,
      isPublic: true,
      type: "chat_message" as const,
      body: turn.body,
      externalId: `intercom_part_${turn.id}`,
      createdAt: new Date(turn.at),
    };
    await db
      .insert(ticketMessages)
      .values({ id: turn.id, ...values })
      .onConflictDoUpdate({ target: ticketMessages.id, set: values });
  }

  console.log(
    `Seeded sample ticket ${TICKET_ID} (customer + bot + human turns, hybrid AI flags).`,
  );
  console.log(`Verify: http://localhost:3009/tickets/${TICKET_ID}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
