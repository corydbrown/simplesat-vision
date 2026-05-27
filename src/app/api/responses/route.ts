import { createIngestRoute } from "@/lib/ingest/handle";
import { responseIngestSchema } from "@/lib/ingest/schemas";
import { upsertResponse } from "@/lib/ingest/upsert";

export const dynamic = "force-dynamic";

export const POST = createIngestRoute(responseIngestSchema, upsertResponse);
