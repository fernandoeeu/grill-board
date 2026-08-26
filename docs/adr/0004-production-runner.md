# 0004 — Plain Node bin harness over TanStack Start output

- **Date:** 2026-08-08
- **Status:** Accepted
- **Decided by:** Owner (grill session)

## Context

The TanStack Start build produces `dist/server/server.js` (a WinterCG fetch handler that does not self-host) and `dist/client/` static assets. A production runner must serve both.

### Alternatives rejected

- **`vite preview` as runtime dependency:** adds ~50 MB to the install.
- **Single binary via `bun build --compile` + bun:sqlite:** would require rewriting the DB layer and shipping 4-8 platform-specific packages.
- **Node SEA / `deno compile`:** cannot embed the better-sqlite3 native addon.

## Decision

Use a plain Node bin harness (~20 lines) that calls `http.createServer`, imports the fetch handler from `dist/server/server.js`, and serves `dist/client/` as static files. better-sqlite3 prebuilds cover 8 platforms, so `npx` needs no C++ toolchain.

## Consequences

- No runtime dependency beyond Node itself and better-sqlite3 (prebuild).
- The harness is small enough to audit in a single screen.
- Future self-hosting changes (e.g., HTTP/2, compression) happen in the harness, not in app code.
