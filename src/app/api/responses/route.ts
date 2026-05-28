import { after } from "next/server";

import { createIngestRoute } from "@/lib/ingest/handle";
import { responseIngestSchema, type ResponseIngest } from "@/lib/ingest/schemas";
import { upsertResponse, type UpsertResult } from "@/lib/ingest/upsert";
import { attachTopicsToResponse } from "@/lib/topics/attach";

export const dynamic = "force-dynamic";

/** Wraps the generic `upsertResponse` to schedule post-write topic-attachment
 *  via `after()` — runs after the response is sent so n8n gets a fast 200 even
 *  when the LLM provider is on a slow path. Errors in the hook are logged but
 *  never propagated: topic classification is a value-add, not part of the
 *  ingest contract. A failed classification leaves `topics = []`, which the
 *  backfill script can re-run later. */
async function upsertResponseWithTopicAttachment(
  workspaceId: string,
  input: ResponseIngest,
): Promise<UpsertResult> {
  const result = await upsertResponse(workspaceId, input);
  after(async () => {
    try {
      await attachTopicsToResponse({
        workspaceId,
        responseId: result.id,
      });
    } catch (err) {
      console.error(
        `[topics] post-write attach failed for response=${result.id}`,
        err,
      );
    }
  });
  return result;
}

export const POST = createIngestRoute(
  responseIngestSchema,
  upsertResponseWithTopicAttachment,
);
