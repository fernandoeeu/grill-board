# Grill Board

A **grill** is an interrogation: an agent questions a human about a plan in rounds, the human answers
on a board, the agent reads the answers back and fires the next round. Grill Board runs many grills
at once, keeps everything in a local SQLite file, and exposes **every** board action as an MCP tool —
agents drive the app through `/mcp`, never through the database file or the HTML.

## Versions

| Piece | Chosen | Note |
|---|---|---|
| TanStack Start | `@tanstack/react-start` 1.168.34 | v1 API, Vite, file routes in `src/routes/` |
| TanStack Router / Query | 1.170.18 / 5.101.4 | route loaders + `setupRouterSsrQueryIntegration` |
| React | 19.2.8 | |
| Tailwind CSS | 4.3.3 | CSS-first (`@theme` in `src/styles.css`), `@tailwindcss/vite`, no `tailwind.config.js` |
| shadcn/ui | CLI 4.16.1, base `aria`, style `nova` | `react-aria-components` 1.20.0 |
| MCP spec revision | **2026-07-28** | stateless Streamable HTTP, no sessions, no SSE transport |
| MCP SDK | `@modelcontextprotocol/server` **2.0.0** (exact pin) | `createMcpHandler()` → web-standard `Request`/`Response` |
| SQLite driver | `better-sqlite3` 13.0.2 | WAL, `foreign_keys = ON`, one connection per process |
| Validation | `zod` 4.4.3 | zod 4, not zod 3 — required by the SDK |
| TypeScript | 6.0.3 (`^6.0.2`) | strict; the `typescript@7` native compiler line is not used here |
| Node | >= 22 | via mise; pnpm only |

### Why the shadcn React Aria base

The UI is built on shadcn/ui with the **React Aria** base (`--base aria`), which shadcn made a
first-class, officially supported component base in July 2026 alongside Base UI and Radix, so we get
Adobe's React Aria Components (v1.20) accessibility behaviour without leaving first-party shadcn code
or reaching for a community registry such as Jolly UI. Every component this app needs ships with an
official `aria` variant, so the whole UI is stock shadcn source with the design tokens applied on top.

One consequence when editing components: the Aria API is not the Radix API — buttons take `onPress`
not `onClick`, there is no `asChild`, and menus use `onAction` instead of a `*Content` wrapper.

### Why MCP SDK v2, and not the v1 fallback

The decision rule was "use `@modelcontextprotocol/server` v2 if it is published and usable, otherwise
fall back to `@modelcontextprotocol/sdk` v1 in stateless mode". It resolves to **v2**, and the
fallback branch is dead: v1 (1.30.0) tops out at protocol revision `2025-11-25` and cannot speak
`2026-07-28` at all, while v2.0.0 sits on the npm `latest` tag and ships `createMcpHandler()`, which
takes exactly the `Request` a TanStack Start server route hands it and returns the `Response` it
expects. The version is pinned exactly (`2.0.0`, no caret) because the wire revision is days old.
`server/discover` answers `supportedVersions: ["2026-07-28"]`, `GET /mcp` answers `405`, and no
`Mcp-Session-Id` header exists anywhere.

The handler keeps the SDK default `legacy: 'stateless'`, so a client that still speaks a 2025-era
revision is served by a fresh stateless instance instead of being rejected. That is still stateless
Streamable HTTP — no session ids, and never the deprecated HTTP+SSE transport.

### Why better-sqlite3

The database driver is `better-sqlite3`: the whole app is a single local Node process where the web
server routes and the MCP handler share one connection, so a synchronous driver removes an entire
class of async plumbing from the data-access layer and is the fastest option for local file-backed
SQLite. Since v13 it ships prebuilt N-API binaries inside the npm tarball, so installing it needs no
`node-gyp`, no Python and no compiler.

## Quickstart

```bash
pnpm install
pnpm dev
```

- App: <http://localhost:3000>
- MCP endpoint: <http://localhost:3000/mcp>

One command runs both — the MCP server is a server route in the same process, on the same port.
No cloud, no Docker.

Other scripts: `pnpm build`, `pnpm start` (serves the build with `vite preview` on port 3000),
`pnpm typecheck`, `pnpm seed`, `pnpm generate-routes`.

## Database

- Default file: `data/grill-board.db` under the project root. WAL mode, so `-wal` and `-shm` siblings
  appear beside it. The whole `data/` directory is gitignored — never commit it.
- Override the path with `GRILL_BOARD_DB`:

```bash
GRILL_BOARD_DB=/tmp/grill-scratch.db pnpm dev
```

- The server entry (`src/server.ts`) opens the database before it serves anything: the first boot
  creates the file, runs the migrations (a small runner with a `schema_version` table) and imports
  the seed topic. Delete `data/` or point `GRILL_BOARD_DB` at a new file and the next boot rebuilds
  it — no extra command.
- `pnpm seed` does the same import from the shell, for scripting. It imports the first topic
  (8 questions, 2 rounds, 4 categories) with every status, answer, recommendation and note
  preserved, and is idempotent: it skips if the topic already exists. The seed topic counts
  **5 of 5** — three of its eight questions are `suspended` or `pending_facts`, and those do not
  count toward progress.
- SQLite is the single source of truth. Draft answers auto-save to it (debounced ~400 ms);
  `localStorage` holds UI preferences only.

## MCP

Register the server with the Claude CLI:

```bash
claude mcp add --transport http grill-board http://localhost:3000/mcp
```

Or by config file:

```json
{
  "mcpServers": {
    "grill-board": { "type": "http", "url": "http://localhost:3000/mcp" }
  }
}
```

Every POST carries `Content-Type: application/json`,
`Accept: application/json, text/event-stream`, `MCP-Protocol-Version: 2026-07-28`,
`Mcp-Method: <method>`, and — for `tools/call` — `Mcp-Name: <tool>`. Each request also carries its
protocol version and client capabilities in `params._meta`. There is no `initialize` handshake and
no session id. `GET /mcp` and `DELETE /mcp` answer `405`, and a cross-site `Origin` header is
refused with `403`.

By hand, the whole wire format looks like this:

```bash
curl -sS -X POST http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2026-07-28' \
  -H 'Mcp-Method: tools/call' \
  -H 'Mcp-Name: get_topic' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{
        "name":"get_topic","arguments":{"topicId":"ephemeral-preview-envs"},
        "_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28",
                 "io.modelcontextprotocol/clientInfo":{"name":"curl","version":"1.0.0"},
                 "io.modelcontextprotocol/clientCapabilities":{}}}}'
```

### Tools

| Tool | Purpose |
|---|---|
| `list_topics` | Every topic with status, counts and progress. Filterable by status. |
| `get_topic` | Full topic state: rounds, all questions with every field, computed progress. |
| `create_topic` | New topic from title, context and ordered categories. Returns its id. |
| `update_topic` | Edit title, context or categories. |
| `archive_topic` | Archive or un-archive a topic. |
| `create_round` | Open a new round on a topic. Returns round id and number. |
| `add_questions` | Batch-add questions to a round (category, text, recommendation?, options?, recommendedOption?, note?, status?). |
| `update_question` | Edit text, recommendation, recommendedOption, options, category or note. |
| `set_question_status` | Move to `open` / `answered` / `suspended` / `pending_facts`, with an optional note. |
| `answer_question` | Record an answer plus `answeredVia` (`chat` or `board`); flips status to `answered`. |
| `list_pending_questions` | Everything still `open` (optionally `pending_facts` too), for one topic or all. |
| `export_answers` | A topic's answers as Markdown (default) or JSON. |

Tool errors come back as readable text ("no topic with id 'x'; call `list_topics`"), never stack
traces. Results are compact JSON: absent fields are omitted instead of being sent as `null`.

A change made through a tool shows up on an open board without a manual refresh — the topic list and
the active topic poll every 2.5 s / 2 s through TanStack Query.

### Worked example

```
1. create_topic   { title: "Rollout do billing", context: "Cobrança por uso",
                    categories: ["Escopo", "Riscos"] }              -> { id: "rollout-do-billing" }
2. create_round   { topicId: "rollout-do-billing" }                 -> { id: "rollout-do-billing#r1", number: 1 }
3. add_questions  { topicId: "rollout-do-billing", roundId: "rollout-do-billing#r1",
                    questions: [ { category: "Escopo", text: "Cobramos por seat ou por uso?",
                                   options: ["Seat", "Uso"] } ] }   -> [ { id: "q1", status: "open" } ]
4. the human opens http://localhost:3000/topics/rollout-do-billing, picks an option, elaborates,
   and presses "Record answer"                                      -> status becomes "answered"
5. export_answers { topicId: "rollout-do-billing" }                 -> "## Answers — Rollout do billing\n\n- **q1** (round 1): Uso — …"
```

Step 4 is the only human step. If the human answers you in chat instead, call `answer_question` with
`answeredVia: "chat"`; the board then shows that answer with an "· answered in chat" tag.

## Dark mode

Light is the default. The toggle in the sidebar footer flips light ↔ dark and stores the choice in
`localStorage` under `grill-board-theme` (the provider also understands `system`, which follows the
OS setting; nothing in the UI selects it today). An inline script applies the class to `<html>` before
hydration, so there is no flash of the wrong theme. Dark mode keeps the same accent hue and swaps the
neutrals (stone-950 background, stone-900 cards, stone-800 hairlines, stone-100 text).

## Layout

```
src/server.ts           server entry: opens and seeds the database, then serves the app
src/lib/types.ts        domain types shared by the DB layer, server functions and MCP tools
src/lib/queries.ts      TanStack Query options and invalidation helpers
src/server/db/*         the only place that speaks SQL (one connection, WAL)
src/server/mcp/*        MCP server and the twelve tools
src/server/functions/*  server functions used by the UI
src/routes/             file routes: /, /topics/$topicId, /mcp
src/components/         shadcn primitives in ui/, board components in board/
scripts/seed.ts         pnpm seed
```
