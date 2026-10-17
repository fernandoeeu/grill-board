# Changelog

## 0.3.0

### Minor changes

- `grill-board/core` is storage-agnostic. A host on another store (Convex, Postgres…) implements the async `GrillStore` port and gets the twelve tools from `grillToolsFor(store, { prefix })`, with async handlers.
- `grillToolSpecs({ prefix })` exports each tool's name, base name, title, description, zod schema and JSON Schema. With a prefix, every cross-reference in descriptions and error messages names the prefixed tool, for example "call grill_create_round next".
- New entry `grill-board/core/rules`: the pure domain rules, with no driver and no zod. It covers normalisation, slugs and topic ids, round numbering, question ids and positions, the `recommendedOption` rules, the declared-categories check, the answer, status and draft transitions, the export formats, `computeProgress` and `summarizeTopic`. The SQLite core is built on these rules.
- `groupByRound`, `isSettled` and `answeredCount` are exported from `grill-board/core` and `grill-board/core/rules`.
- The error builders (`topicNotFound`, `roundNotFound`, `questionNotFound`, `topicIdTaken`, `questionIdTaken`) and `toolName` are exported and take an optional prefix.

No breaking change: `createGrillCore` and `grillTools(core)` behave as in 0.2.0, and the unprefixed tool names, descriptions and schemas are byte-identical.

## 0.2.0

- `grill-board/core`: the domain, the migrations and the twelve MCP tools as a library over a host-owned SQLite connection.
