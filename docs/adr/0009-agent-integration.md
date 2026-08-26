# 0009 — First-boot MCP registration offer

- **Date:** 2026-08-08
- **Status:** Accepted
- **Decided by:** Owner (grill session)

## Context

The Grill Board exposes an MCP endpoint that agents use to create topics, post questions, and read answers. Registering it with `claude mcp add` is a manual step users may not know about.

## Decision

On first boot, print the exact registration command (`claude mcp add --transport http grill-board http://localhost:<real-port>/mcp`) and offer to run it with an explicit `[y/N]` prompt. Also mention the `grill-board` skill for agent workflows.

## Consequences

- Agents can interact with the board immediately after the user accepts.
- The real port (ADR 0006) is used in the command, not a hardcoded value.
- Users who decline can run the command manually later.
