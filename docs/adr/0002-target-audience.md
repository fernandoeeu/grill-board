# 0002 — Target audience: devs running agent skills on macOS/Linux

- **Date:** 2026-08-08
- **Status:** Accepted
- **Decided by:** Owner (grill session)

## Context

The grill flow originated as a Matt Pocock-style agent skill. Its primary users are developers who run Claude or similar agents on their local machines.

## Decision

Target audience is developers using Matt Pocock-style agent skills on macOS or Linux with Node 22+.

## Consequences

- Documentation, CLI output, and defaults assume a Unix shell environment.
- Node 22+ is the minimum runtime; no polyfills for older versions.
- Windows is not a primary target but is not explicitly blocked.
