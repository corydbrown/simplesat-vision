import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/** Header carrying the HMAC, formatted `sha256=<hex>` (GitHub/Stripe-style so
 *  the algorithm is self-describing and future schemes can coexist). */
export const SIGNATURE_HEADER = "x-signature";
/** Header carrying the Unix-seconds timestamp that was signed alongside the
 *  body. Bounds the replay window. */
export const SIGNATURE_TIMESTAMP_HEADER = "x-signature-timestamp";

/** How far a request's timestamp may drift from server time before it's
 *  rejected as a replay (each direction). Five minutes matches the common
 *  webhook convention and tolerates modest clock skew. Override with
 *  `INGEST_SIGNATURE_TOLERANCE_SEC`. */
function toleranceSec(): number {
  const raw = process.env.INGEST_SIGNATURE_TOLERANCE_SEC;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 300;
}

export type SignatureResult =
  | { ok: true }
  | { ok: false; error: string };

/** Canonical signed string: `<timestamp>.<rawBody>`. Binding the timestamp
 *  into the MAC (not just sending it alongside) is what makes the timestamp
 *  tamper-evident — an attacker can't slide the replay window forward without
 *  invalidating the signature. Exported so a future client SDK signs
 *  identically. */
export function signingPayload(timestamp: string, rawBody: string): string {
  return `${timestamp}.${rawBody}`;
}

/** Compute the hex HMAC-SHA256 for a payload under `secret`. */
export function computeSignature(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Constant-time hex compare. Returns false (never throws) on any
 *  length/format mismatch so a malformed signature is a clean rejection, not a
 *  500. */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/** Verify an ingest request's signature against a key's signing secret.
 *
 *  Only called when the resolved key HAS a signing secret — unsigned keys
 *  (e.g. the live n8n caller today) never reach here, so signing stays
 *  strictly opt-in and additive. Checks, in order: both headers present →
 *  timestamp is fresh (within tolerance) → HMAC over `<ts>.<body>` matches in
 *  constant time. */
export function verifySignature(
  rawBody: string,
  headers: Headers,
  secret: string,
): SignatureResult {
  const provided = headers.get(SIGNATURE_HEADER)?.trim();
  const timestamp = headers.get(SIGNATURE_TIMESTAMP_HEADER)?.trim();

  if (!provided || !timestamp) {
    return {
      ok: false,
      error: `Signing required for this key: send ${SIGNATURE_HEADER} and ${SIGNATURE_TIMESTAMP_HEADER}`,
    };
  }

  const tsSec = Number(timestamp);
  if (!Number.isFinite(tsSec)) {
    return { ok: false, error: "Malformed signature timestamp" };
  }

  const nowSec = Date.now() / 1000;
  if (Math.abs(nowSec - tsSec) > toleranceSec()) {
    return {
      ok: false,
      error: "Signature timestamp outside tolerance (possible replay)",
    };
  }

  const match = /^sha256=([0-9a-f]+)$/i.exec(provided);
  if (!match) {
    return { ok: false, error: "Malformed signature (expected sha256=<hex>)" };
  }

  const expected = computeSignature(secret, signingPayload(timestamp, rawBody));
  if (!safeEqualHex(match[1].toLowerCase(), expected)) {
    return { ok: false, error: "Signature mismatch" };
  }

  return { ok: true };
}
