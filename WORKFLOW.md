# Workflow — multi-session development

How to work on this repo with multiple Claude Code sessions in parallel without collisions.

## Setup (one time)

Add `~/Documents/Cowork/bin` to your `$PATH`. Append to `~/.zshrc`:

```bash
export PATH="$HOME/Documents/Cowork/bin:$PATH"
```

Then `source ~/.zshrc` (or open a new terminal).

Verify: `which nw` should print `/Users/cory/Documents/Cowork/bin/nw`.

## The fast path — just say `/start`

In any Claude Code session, type `/start` (or "new session", "menu", "what now?"). Claude detects whether you're in supervisor or worker context and offers a menu of next actions. Pick one, it does the work, then tells you the next step.

You almost never need to know the underlying git commands — these slash commands cover the full lifecycle:

| Command | When | What it does |
|---|---|---|
| `/start` | Beginning of any session | Detects context (supervisor vs worker), shows an options menu |
| `/ship` | Worker session, after a commit | Pushes the branch, opens a PR with `--fill`, reports the Vercel preview URL |
| `/cleanup` | After a PR is merged | Removes the worktree, deletes the branch, prunes stale remote refs |

The rest of this doc explains what's happening under the hood, for the rare times you need to reach past these.

## The pattern

**1 task = 1 worktree = 1 Claude Code window = 1 PR.**

- Main repo (`simplesat-vision/`) stays on `main`. Used as the "supervisor" session — reviewing PRs, merging, doc edits, planning.
- Feature work happens in worktrees at `../simplesat-vision-worktrees/<feature>/`, each on its own `feat/<feature>` branch.
- Claude commits on feature branches without per-commit approval. You review at PR-diff level.

## Spawn a worktree

```bash
cd ~/Documents/Cowork/simplesat-vision
nw drawer-perf
```

This:
- Creates `../simplesat-vision-worktrees/drawer-perf/` on branch `feat/drawer-perf` off `main`.
- Runs `npm install` (isolated `node_modules`).
- Runs `npm run db:reset` (isolated `db/simplesat.db`).
- Writes `PORT=<next-available>` to `.env.local` (3001, 3002, … in order of creation).

Then open that directory in a new VS Code / Cursor window and start a fresh Claude Code session inside it.

## Run the dev server

Inside a worktree:
```bash
npm run dev
```

Next.js will use the `PORT` from `.env.local`. Main repo uses 3000; worktrees get 3001+.

## Open a PR from a worktree

When the feature is ready:
```bash
git add .
git commit -m "feat: <summary>"
git push -u origin feat/<feature>
gh pr create --fill
```

Then switch to your main repo window and review the diff. Run `/review` or `/ultrareview` if you want extra scrutiny.

## Merge and clean up

After merging the PR (in main repo window or via gh):
```bash
cd ~/Documents/Cowork/simplesat-vision
git pull
git worktree remove ../simplesat-vision-worktrees/<feature>
git branch -d feat/<feature>
```

## Port map

| Worktree | Port |
|---|---|
| Main repo (`simplesat-vision/`) | 3000 |
| Worktree #1 | 3001 |
| Worktree #2 | 3002 |
| ... | ... |

The `nw` script auto-assigns based on how many worktrees already exist.

## Collision avoidance — why this works

- `.next/` cache: lives inside each worktree directory, so dev servers don't clobber each other.
- `db/simplesat.db`: same — local to each worktree. Reseeded per spawn.
- Dev server: each worktree picks a unique port from `.env.local`.
- Git: worktrees are first-class — each is checked out to a different branch, all sharing the same `.git/` object store.

## Don't do

- Don't run multiple `npm run dev` instances on the same port. Use the PORT in `.env.local`.
- Don't `git worktree remove --force` unless the worktree is genuinely abandoned. The default `git worktree remove` will refuse if you have uncommitted changes — that's a feature.
- Don't commit `.env.local`. It contains the per-worktree PORT and any secrets.

## Built-in helpers worth knowing

| Skill / tool | When |
|---|---|
| `/start` | Concierge menu for the current session — see top of this doc |
| `/ship` | Push current branch + open a PR |
| `/cleanup` | Tear down a merged worktree + branch |
| `/review` | Review a PR before merging |
| `/ultrareview <PR#>` | Multi-agent cloud review on a PR (Cory triggers — billed) |
| `/security-review` | Pre-merge security pass on the diff |
| `/simplify` | Cleanup pass after a feature lands |
| `/fewer-permission-prompts` | Top up the permission allowlist based on recent transcripts |
| `/loop 10m <command>` | Recurring task (e.g. poll a long-running job) |
| `Agent(isolation: "worktree")` | Sub-isolated experimental workspace inside a Claude session |
