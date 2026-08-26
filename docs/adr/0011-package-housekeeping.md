# 0011 — Remove private flag, gate devtools behind DEV

- **Date:** 2026-08-08
- **Status:** Accepted
- **Decided by:** Owner (grill session)

## Context

The repo currently has `"private": true` in `package.json`, which blocks `npm publish`. The TanStack Devtools vite plugin is included unconditionally, adding weight to the production bundle.

## Decision

Remove `"private": true` from `package.json`. Add `bin` and `files` fields to support distribution. Gate the TanStack Devtools vite plugin behind `import.meta.env.DEV` (or the vite `apply: 'serve'` option) so it is excluded from production builds.

## Consequences

- `npm publish` becomes possible.
- The `files` field controls what ships in the tarball, keeping it small.
- Devtools remain available in development but add zero bytes to the published package.
