import { createIngestRoute } from "@/lib/ingest/handle";
import { customerIngestSchema } from "@/lib/ingest/schemas";
import { upsertCustomer } from "@/lib/ingest/upsert";

export const dynamic = "force-dynamic";

export const POST = createIngestRoute(customerIngestSchema, upsertCustomer);
