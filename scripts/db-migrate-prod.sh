#!/usr/bin/env bash
#
# Apply pending Drizzle migrations against the prod Turso DB.
#
# Why this exists: `npm run db:migrate` (drizzle-kit) targets whatever DB the
# current shell happens to point at, and drizzle-kit doesn't error if the env
# is missing — it just silently writes to `file:db/simplesat.db`. That's a
# footgun when you mean to migrate prod. This wrapper:
#   1. Loads .env.local (npm scripts don't auto-load it).
#   2. Refuses to run unless TURSO_DATABASE_URL is set.
#   3. Prints the target + pending migration files.
#   4. Confirms before applying.
#
# See DECISIONS.md → "Migration safety" for the lesson behind this.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f .env.local ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
else
  echo "warn: .env.local not found at $ROOT/.env.local" >&2
fi

if [ -z "${TURSO_DATABASE_URL:-}" ]; then
  echo "error: TURSO_DATABASE_URL is not set." >&2
  echo "       Set it in .env.local (or export it) before running db:migrate:prod." >&2
  echo "       This script refuses to fall through to the local sqlite file." >&2
  exit 1
fi

echo "Target:  $TURSO_DATABASE_URL"
echo ""
echo "Migration files in ./drizzle:"
ls -1 drizzle/*.sql 2>/dev/null | sed 's|^|  |' || echo "  (none)"
echo ""
echo "drizzle-kit applies any files newer than what's recorded in the target's"
echo "__drizzle_migrations table. To see exactly which will run, you can"
echo "compare the list above against that table via 'turso db shell'."
echo ""

read -r -p "Apply pending migrations to the URL above? [y/N] " reply
case "$reply" in
  y|Y|yes|YES) ;;
  *)
    echo "aborted."
    exit 1
    ;;
esac

echo ""
echo "Running drizzle-kit migrate..."
npx drizzle-kit migrate
echo ""
echo "done → $TURSO_DATABASE_URL"
