import { createIngestRoute } from "@/lib/ingest/handle";
import { messageIngestSchema } from "@/lib/ingest/schemas";
import { upsertMessage } from "@/lib/ingest/upsert";

export const dynamic = "force-dynamic";

export const POST = createIngestRoute(messageIngestSchema, upsertMessage);
