import "server-only";

import { NextResponse } from "next/server";

/** Outcome of a single `consume`. `remaining`/`limit` feed the standard
 *  `RateLimit-*` response headers; `retryAfterMs` drives `Retry-After` on a
 *  denial. */
export type RateLimitResult = {
  allowed: boolean;
  /** Whole tokens left in the bucket after this consume. */
  remaining: number;
  /** Bucket capacity (the burst ceiling) — reported as the limit. */
  limit: number;
  /** When denied, milliseconds until enough tokens refill for this request.
   *  0 when allowed. */
  retryAfterMs: number;
};

/** Production-shape seam. The ingest routes depend on THIS interface, never on
 *  a concrete store, so swapping the cheap in-memory bucket for a SQLite- or
 *  Redis-backed one later is a one-file change with zero route edits. `consume`
 *  is async precisely so a network/DB-backed impl drops in without touching
 *  callers. */
export interface RateLimiter {
  /** Attempt to spend `cost` tokens from `key`'s bucket. */
  consume(key: string, cost?: number): Promise<RateLimitResult>;
}

type Bucket = { tokens: number; lastRefillMs: number };

/** Token bucket held in process memory. Cheap and dependency-free.
 *
 *  Serverless caveat: each Vercel instance keeps its own Map, so the effective
 *  limit is per-instance, not global. That errs on the *permissive* side
 *  (a key spread across N instances gets up to N× the nominal rate), which is
 *  the safe direction for ingest — the requirement is "never throttle the
 *  legitimate n8n burst," not "enforce a hard global ceiling." When a true
 *  global limit is needed, implement `RateLimiter` over Turso or Redis and
 *  swap the `defaultIngestRateLimiter` export below. */
export class InMemoryTokenBucket implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    /** Burst capacity — the most a key can spend after a quiet period. */
    private readonly capacity: number,
    /** Sustained steady-state rate, in tokens per second. */
    private readonly refillPerSec: number,
  ) {}

  async consume(key: string, cost = 1): Promise<RateLimitResult> {
    const now = Date.now();
    const bucket = this.buckets.get(key) ?? {
      tokens: this.capacity,
      lastRefillMs: now,
    };

    // Lazily refill based on elapsed wall-clock time since the last touch.
    const elapsedSec = Math.max(0, now - bucket.lastRefillMs) / 1000;
    bucket.tokens = Math.min(
      this.capacity,
      bucket.tokens + elapsedSec * this.refillPerSec,
    );
    bucket.lastRefillMs = now;

    let allowed = false;
    let retryAfterMs = 0;
    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      allowed = true;
    } else {
      const deficit = cost - bucket.tokens;
      retryAfterMs = Math.ceil((deficit / this.refillPerSec) * 1000);
    }

    this.buckets.set(key, bucket);

    return {
      allowed,
      remaining: Math.floor(bucket.tokens),
      limit: this.capacity,
      retryAfterMs,
    };
  }
}

/** Positive integer env override, or the fallback. Guards against empty / NaN /
 *  non-positive values silently disabling the limiter. */
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Generous defaults so the live n8n backfill is never throttled: a 2000-token
 *  burst with 50 tokens/sec sustained, per API key. Bulk ingest counts as ONE
 *  token regardless of item count, so a backfill of thousands of records costs
 *  a handful of tokens. Tune via `INGEST_RATE_LIMIT_BURST` /
 *  `INGEST_RATE_LIMIT_REFILL_PER_SEC`. */
export const defaultIngestRateLimiter: RateLimiter = new InMemoryTokenBucket(
  envInt("INGEST_RATE_LIMIT_BURST", 2000),
  envInt("INGEST_RATE_LIMIT_REFILL_PER_SEC", 50),
);

/** Build the `429` response for a denied request: a stable JSON shape plus the
 *  standard `Retry-After` (seconds) and `RateLimit-*` headers callers expect. */
export function rateLimitedResponse(result: RateLimitResult): NextResponse {
  const retryAfterSec = Math.ceil(result.retryAfterMs / 1000);
  return NextResponse.json(
    {
      error: "Rate limit exceeded",
      retryAfterMs: result.retryAfterMs,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "RateLimit-Limit": String(result.limit),
        "RateLimit-Remaining": String(result.remaining),
      },
    },
  );
}
