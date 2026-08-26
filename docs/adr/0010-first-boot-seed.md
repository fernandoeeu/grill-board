# 0010 — Tutorial topic as first-boot seed

- **Date:** 2026-08-08
- **Status:** Accepted
- **Decided by:** Owner (grill session)

## Context

The current sample topic does not teach new users how the grill flow works. An empty board on first launch is unhelpful.

## Decision

Replace the current sample topic with a tutorial topic that teaches the grill flow: what rounds are, how pills (options) work, and how an agent reads the user's answers. The seed is inserted on first boot (empty database).

## Consequences

- New users learn by doing instead of reading external docs.
- The tutorial topic can be deleted by the user after they understand the flow.
- The seed runs only when the database has no existing topics.
