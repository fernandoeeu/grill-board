# 0013 — FSL-1.1-MIT license

- **Date:** 2026-08-26
- **Status:** Accepted
- **Decided by:** Owner (grill session q16)
- **Supersedes:** 0001, 0012 (license portion)

## Context

The Grill Board is distributed as an npm package. The original plan (ADR 0001) used MIT. After reviewing how the software will be used commercially, a license that protects against competing use while still converting to full open source after two years is a better fit.

## Decision

License the project under FSL-1.1-MIT (Functional Source License, Version 1.1, MIT Future License). The `LICENSE` file at the repo root carries the full text. `package.json` declares `"license": "FSL-1.1-MIT"`.

### Why FSL-1.1-MIT over MIT

- Prevents competitors from forking the product and offering it as a competing service during the initial two-year window.
- After the Change Date (two years per release), each release automatically converts to MIT, giving the community full open-source freedom.
- The restriction is narrow: only competing use is prohibited. Internal use, modification, and non-competing redistribution are allowed from day one.

## Consequences

- npm publish requires `"license": "FSL-1.1-MIT"` and no `"private": true`.
- Contributors must accept the FSL-1.1-MIT terms.
- The public repo URL is `github.com/fernandoeeu/grill-board` (see ADR 0012, now superseded for the license portion but the repo location stands).
