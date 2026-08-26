# 0014 — Effect v4 RC pinned serve entry

- **Date:** 2026-08-26
- **Status:** Accepted
- **Decided by:** Owner (grill session)
- **Supersedes:** 0004

## Context

ADR 0004 chose a plain Node `http.createServer` bin harness (~20 lines) to serve the TanStack Start build output. As the project grew, the harness needed structured error handling, graceful shutdown, and composable middleware — concerns that plain Node handles ad hoc.

Effect v4 RC provides a typed, composable runtime with built-in HTTP serving, structured concurrency, and graceful shutdown. Pinning to the RC locks the API surface for the distribution milestone.

## Decision

Replace the plain Node bin harness with an Effect v4 RC entry point. The serve layer uses `@effect/platform` HTTP facilities. The entry is pinned to the Effect v4 RC version range to avoid breaking changes before stable.

## Consequences

- The bin entry gains structured error channels, typed configuration, and composable layers.
- Effect v4 RC is a production dependency; the pin must be revisited when Effect v4 goes stable.
- The harness is no longer a 20-line script but remains a single-file entry point.
- Future middleware (compression, auth, metrics) composes as Effect layers without changing the entry structure.
