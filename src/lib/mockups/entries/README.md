# Mockup entries

Each mockup variation gets its own file here, exporting a single
`meta: MockupMeta` constant. The assembler in `../registry.ts` imports
each entry and concatenates them into the `MOCKUPS` array consumed by
`/mockups`.

## Why one file per entry

Parallel mockup workers used to all append to the same `MOCKUPS` array in
`registry.ts`, causing guaranteed git merge conflicts when more than one
worker landed per round. One-file-per-entry eliminates that surface.

## Adding a new entry

1. Create `<theme>-<variant>.ts` here (e.g. `qa-window-popover.ts`).
2. Export a single `meta: MockupMeta` constant.
3. Open `../registry.ts` and add (a) the `import` line and (b) the entry
   reference in the `MOCKUPS` array. This is the only edit to the
   assembler — keep it mechanical so reviewers can read it at a glance.
4. Set `round` to the current supervisor-assigned round number. If unsure,
   grep the most recent merge commits for `round:` and use the highest
   existing value (or +1 if you're starting a new round).
