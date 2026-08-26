# 0006 — Port 3000 with free-port fallback

- **Date:** 2026-08-08
- **Status:** Accepted
- **Decided by:** Owner (grill session)

## Context

Port 3000 is the conventional dev port and is easy to remember, but it is often already in use.

## Decision

Attempt to bind port 3000. If it is taken, fall back to an OS-assigned free port. Print the real URL to stdout on startup. Any UI copy that hardcodes `localhost:3000` (e.g., the landing/index page) must be templated with the actual port.

## Consequences

- The app always starts, even when 3000 is occupied.
- Agents and users must read the printed URL rather than assuming port 3000.
- The MCP registration command (ADR 0009) uses the real port.
