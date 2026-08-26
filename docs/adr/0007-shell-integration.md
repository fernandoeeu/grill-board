# 0007 — First-run shell alias snippet with opt-in rc edit

- **Date:** 2026-08-08
- **Status:** Accepted
- **Decided by:** Owner (grill session)

## Context

A shell alias lets users type `grill-board` instead of `npx grill-board` after a global install. The alias syntax differs between zsh, bash, and fish.

## Decision

On first run, detect `$SHELL` and print the correct alias snippet for the detected shell. Offer to append it to the appropriate rc file (`~/.zshrc`, `~/.bashrc`, or `~/.config/fish/config.fish`) with an explicit `[y/N]` prompt. Never auto-edit the rc file.

## Consequences

- Users opt in to the shell change; no surprise edits.
- Three shell dialects are supported (zsh, bash, fish).
- The prompt is skipped on subsequent runs (first-boot only).
