import { createIngestRoute } from "@/lib/ingest/handle";
import { ticketIngestSchema } from "@/lib/ingest/schemas";
import { upsertTicket } from "@/lib/ingest/upsert";

export const dynamic = "force-dynamic";

export const POST = createIngestRoute(ticketIngestSchema, upsertTicket);
