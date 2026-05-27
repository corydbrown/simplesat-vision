/**
 * Seed-time avatar generator (DiceBear fallback tier).
 *
 * Renders DiceBear "croodles-neutral" SVGs for every distinct customer +
 * team-member NAME the prototype uses (plus a small static list for
 * design-page demos) and writes them to `public/avatars/<hash>.svg`. The
 * filename hash is computed by `src/lib/avatar-hash.ts` — the runtime
 * `dicebearUrl()` uses the same hash so the URL and the on-disk filename agree.
 *
 * Seed key parity with `resolveAvatar` (src/lib/avatar.ts): both seed DiceBear
 * by NAME. The seed key is name (not email/id) because this committed SVG set
 * is name-keyed and served statically — the render seed must match what was
 * generated, or the URL 404s into bare initials.
 *
 * NOTE: the committed `public/avatars/*.svg` were generated with the previous
 * "avataaars" style. They refresh to croodles-neutral the next time this runs
 * against a populated DB (seed is broken repo-wide as of this writing — see the
 * follow-up task). The code here is correct; only the on-disk artifact lags.
 *
 * Idempotent: hashing is deterministic, output is byte-stable, so running
 * this multiple times produces no diff.
 *
 * Runs after `db:seed`; can also be invoked standalone via
 * `npm run avatars:generate`.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createAvatar } from "@dicebear/core";
import * as croodlesNeutral from "@dicebear/croodles-neutral";
import { db, schema } from "../src/db/client";
import { avatarHash } from "../src/lib/avatar-hash";

// Seeds that appear in code but not in the seeded DB (e.g. design audit pages
// that hardcode demo initials). Keep this list short — anything that survives
// belongs as a real entity.
const STATIC_SEEDS = ["CR"];

const OUT_DIR = resolve(process.cwd(), "public/avatars");

async function collectSeeds(): Promise<string[]> {
  const [customerNames, teamMemberNames] = await Promise.all([
    db.select({ name: schema.customers.name }).from(schema.customers),
    db.select({ name: schema.teamMembers.name }).from(schema.teamMembers),
  ]);
  const seeds = new Set<string>(STATIC_SEEDS);
  for (const { name } of customerNames) seeds.add(name);
  for (const { name } of teamMemberNames) seeds.add(name);
  return [...seeds];
}

async function generate() {
  await mkdir(OUT_DIR, { recursive: true });
  const seeds = await collectSeeds();
  console.log(`Generating ${seeds.length} avatar SVGs into ${OUT_DIR}`);

  await Promise.all(
    seeds.map(async (seed) => {
      const svg = createAvatar(croodlesNeutral, { seed }).toString();
      const filename = `${avatarHash(seed)}.svg`;
      await writeFile(resolve(OUT_DIR, filename), svg, "utf8");
    }),
  );

  console.log(`Wrote ${seeds.length} avatars.`);
}

generate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
