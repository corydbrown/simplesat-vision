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
#   5. Counts __drizzle_migrations rows before+after, and the journal entries
#      on disk. Fails loudly if post-row-count != journal-entry-count — that
#      catches the "drizzle-kit prints 'applied successfully' but actually did
#      nothing" silent-no-op mode (SVP-220). Without the assertion, the only
#      symptom was schema drift discovered hours later.
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

count_migrations_row() {
  npx --yes tsx -e "import('@libsql/client').then(async m => { const c = m.createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN }); const r = await c.execute('SELECT count(*) AS n FROM __drizzle_migrations'); console.log(r.rows[0].n); c.close(); })" 2>/dev/null
}

count_journal_entries() {
  node -e "console.log(JSON.parse(require('fs').readFileSync('drizzle/meta/_journal.json','utf8')).entries.length)"
}

echo "Target:  $TURSO_DATABASE_URL"
echo ""
echo "Migration files in ./drizzle:"
ls -1 drizzle/*.sql 2>/dev/null | sed 's|^|  |' || echo "  (none)"
echo ""

JOURNAL_COUNT=$(count_journal_entries)
ROW_COUNT_BEFORE=$(count_migrations_row || echo "?")
echo "Journal entries on disk:           $JOURNAL_COUNT"
echo "__drizzle_migrations rows (before): $ROW_COUNT_BEFORE"
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

ROW_COUNT_AFTER=$(count_migrations_row || echo "?")
echo "__drizzle_migrations rows (after):  $ROW_COUNT_AFTER"

if [ "$ROW_COUNT_AFTER" != "$JOURNAL_COUNT" ]; then
  echo "" >&2
  echo "error: post-migrate row count ($ROW_COUNT_AFTER) does not match journal" >&2
  echo "       entries ($JOURNAL_COUNT). drizzle-kit silently no-op'd (see SVP-220)" >&2
  echo "       or a migration failed partway. Reconcile before shipping." >&2
  exit 1
fi

echo "done → $TURSO_DATABASE_URL"
