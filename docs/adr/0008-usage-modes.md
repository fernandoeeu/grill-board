# 0008 — Support both npx one-shot and global install

- **Date:** 2026-08-08
- **Status:** Accepted
- **Decided by:** Owner (grill session)

## Context

Some users want to try the tool once; others want it always available.

## Decision

Support both `npx grill-board` (one-shot, no install) and `npm i -g grill-board` (persistent). After a successful npx run, print `npm i -g grill-board` as a persistence hint.

## Consequences

- Data directory (ADR 0005) is shared across both modes, so state is preserved.
- The persistence hint is informational, not a requirement.
