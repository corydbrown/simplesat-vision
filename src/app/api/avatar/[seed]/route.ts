/**
 * DiceBear avatar route — generates a croodles-neutral SVG on demand,
 * content-addressed by the `seed` path segment (the entity's NAME).
 *
 * Replaces the previous self-hosted `public/avatars/<hash>.svg` set, which
 * 404'd for any name not present at the last seed-time generator run (every
 * live customer + every new seed-data tweak). See DECISIONS.md → SVP-208.
 *
 * Seed = name (parity with `resolveAvatar` in src/lib/avatar.ts). The URL is
 * `/api/avatar/<encodeURIComponent(name)>`. `Cache-Control: immutable` is
 * load-bearing — the (CDN, browser cache) pair carries the cost after the
 * first cold hit per seed (~5–20ms render).
 *
 * `runtime = "nodejs"` because @dicebear/core uses APIs the Edge runtime
 * doesn't ship.
 */
import { createAvatar } from "@dicebear/core";
import * as croodlesNeutral from "@dicebear/croodles-neutral";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ seed: string }> },
) {
  const { seed } = await params;
  const svg = createAvatar(croodlesNeutral, { seed }).toString();
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
