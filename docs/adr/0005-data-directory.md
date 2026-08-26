# 0005 — XDG-compliant default data directory

- **Date:** 2026-08-08
- **Status:** Accepted
- **Decided by:** Owner (grill session)

## Context

The app stores its state in a SQLite database. In development, the DB defaults to the current working directory. For distribution, a stable, predictable location is needed.

## Decision

Default data directory follows the XDG Base Directory Specification: `~/.local/share/grill-board/grill-board.db`. Respect `XDG_DATA_HOME` when set. The bin harness sets the existing `GRILL_BOARD_DB` env var before importing the server; no server code change is required. The cwd-relative default stays for `pnpm dev`.

## Consequences

- User data survives across npx runs and version upgrades.
- The directory is created on first run if it does not exist.
- Users who set `GRILL_BOARD_DB` explicitly override the default, preserving current behavior.
