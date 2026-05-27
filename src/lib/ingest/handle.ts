import "server-only";

import { NextResponse } from "next/server";
import type { z } from "zod";

import { authenticateApiKey } from "@/lib/ingest/auth";
import {
  defaultIngestRateLimiter,
  rateLimitedResponse,
} from "@/lib/ingest/rate-limit";
import { parseIngestBody } from "@/lib/ingest/schemas";
import { verifySignature } from "@/lib/ingest/signing";
import { UnknownReferenceError, type UpsertResult } from "@/lib/ingest/upsert";

/** Per-item outcome in a response. Success carries `{ id, created }`; a bad
 *  reference carries a 422-shaped error so a bulk batch reports failures
 *  inline instead of rejecting the whole array. */
type ItemResult =
  | { ok: true; id: string; created: boolean }
  | { ok: false; status: 422; error: string };

async function runItem<T>(
  workspaceId: string,
  item: T,
  upsert: (workspaceId: string, item: T) => Promise<UpsertResult>,
): Promise<ItemResult> {
  try {
    const { id, created } = await upsert(workspaceId, item);
    return { ok: true, id, created };
  } catch (err) {
    if (err instanceof UnknownReferenceError) {
      return { ok: false, status: 422, error: err.message };
    }
    throw err;
  }
}

/** Build a POST route handler for one ingest entity: authenticate (Bearer key →
 *  workspace), parse single-or-bulk body (Zod 400 on bad shape), upsert each
 *  item by `external_id`. Single body → bare `{ id, created }` (or 422 on an
 *  unknown reference). Bulk `{ items: [...] }` → `{ results: [...] }` with each
 *  item's outcome inline, so one bad reference doesn't sink the batch. */
export function createIngestRoute<T>(
  schema: z.ZodType<T>,
  upsert: (workspaceId: string, item: T) => Promise<UpsertResult>,
) {
  return async function POST(request: Request): Promise<NextResponse> {
    const auth = await authenticateApiKey(request);
    if (!auth.ok) return auth.response;

    // Per-key rate limit. One token per request — a bulk batch of N items is
    // still a single token, so a backfill stays cheap.
    const limit = await defaultIngestRateLimiter.consume(auth.keyId);
    if (!limit.allowed) return rateLimitedResponse(limit);

    // Read the body as text first: signature verification needs the exact
    // bytes that were signed, and we parse JSON from the same string.
    let rawBody: string;
    try {
      rawBody = await request.text();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Signing is opt-in: enforced only when this key has a signing secret.
    // Unsigned keys (the live n8n caller today) skip this entirely and keep
    // working — nothing about their requests changes.
    if (auth.signingSecret) {
      const sig = verifySignature(rawBody, request.headers, auth.signingSecret);
      if (!sig.ok) {
        return NextResponse.json({ error: sig.error }, { status: 401 });
      }
    }

    let raw: unknown;
    try {
      raw = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = parseIngestBody(schema, raw);
    if (!parsed.ok) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { items, bulk } = parsed.data;

    if (!bulk) {
      const result = await runItem(auth.workspaceId, items[0], upsert);
      return result.ok
        ? NextResponse.json({ id: result.id, created: result.created })
        : NextResponse.json({ error: result.error }, { status: result.status });
    }

    const results = await Promise.all(
      items.map((item) => runItem(auth.workspaceId, item, upsert)),
    );
    return NextResponse.json({
      results: results.map((r) =>
        r.ok ? { id: r.id, created: r.created } : { error: r.error },
      ),
    });
  };
}
