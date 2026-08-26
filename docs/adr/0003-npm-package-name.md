# 0003 — Publish as `grill-board` on npm with a bin entry

- **Date:** 2026-08-08
- **Status:** Accepted
- **Decided by:** Owner (grill session)

## Context

The app needs a distribution channel that requires zero setup for the target audience. npm is the obvious choice for Node developers.

## Decision

Publish a public npm package named `grill-board` with a `bin` field. Users run it via `npx grill-board` (or `bunx grill-board`). The name was verified free on npm on 2026-08-08 and should be registered soon.

## Consequences

- The package name is a first-come resource; register it before someone else does.
- `bunx` works identically to `npx` with no extra effort.
- The `bin` field points to the Node harness (see ADR 0004).
