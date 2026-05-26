<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Next.js 16 gotchas

- `params` and `searchParams` are Promises in pages and route handlers. Always `await props.params` / `await props.searchParams`.
- Use `PageProps<"/path">` type helper from generated route types.
- `next lint` is gone. Use `eslint` directly (`npm run lint`).
- Turbopack is the default. `--turbopack` flag no longer needed.
- Dev cache lives in `.next/dev/`. If you see `Cannot find module '.next/dev/...'` errors, kill `next dev` and `rm -rf .next` and restart.
- `force-dynamic` is needed wherever client `useSearchParams` is in the tree. Workspace layout sets it (because `GlobalDrawer` reads `?drawer=`), so leaf pages inherit. Section layouts also set it as belt-and-suspenders.
- **`middleware.ts` is now `proxy.ts`**, and it lives at `src/proxy.ts` (NOT the repo root) because this project uses the `src/` layout. A `middleware.ts` at the repo root will silently no-op. See `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` and the existing `src/proxy.ts` for the pattern.
