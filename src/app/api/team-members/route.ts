import { createIngestRoute } from "@/lib/ingest/handle";
import { teamMemberIngestSchema } from "@/lib/ingest/schemas";
import { upsertTeamMember } from "@/lib/ingest/upsert";

export const dynamic = "force-dynamic";

export const POST = createIngestRoute(teamMemberIngestSchema, upsertTeamMember);
