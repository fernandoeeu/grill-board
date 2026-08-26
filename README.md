# Grill Board

A **grill** is an interrogation: an agent questions a human about a plan in rounds, the human answers
on a board, the agent reads the answers back and fires the next round. Grill Board runs many grills
at once, keeps everything in a local SQLite file, and exposes every board action as an MCP tool.

## Quick start

```bash
npx grill-board
```

The app starts on `http://localhost:3000`. The MCP endpoint lives at `/mcp` on the same port.
No cloud, no Docker, no global install required.

## Initialization

After the first run, register the MCP server and install skills:

```bash
grill-board init
```

`init` does two things:

1. Registers the Grill Board MCP server with Claude Code.
2. Installs the `grilling` and `grill-with-docs` skills.

Both steps are idempotent — running `init` again skips what is already configured.

## MCP registration (manual)

If you prefer to register the MCP server by hand instead of using `init`:

```bash
claude mcp add --transport http grill-board http://localhost:3000/mcp
```

Or add to your MCP config file:

```json
{
  "mcpServers": {
    "grill-board": { "type": "http", "url": "http://localhost:3000/mcp" }
  }
}
```

## Skill setup

The grill technique skills teach an agent how to run a grill session. They are not bundled in
the package — install them from the [Matt Pocock skill registry](https://github.com/mattpocock/claude-code-skills):

- **grilling** — core grill interrogation loop
- **grill-with-docs** — grill that pulls context from project documentation

`grill-board init` installs both automatically. To install them manually, follow the instructions
in the skill registry.

## Upgrade

Pull the latest version:

```bash
npx grill-board@latest
```

Or install globally and update in place:

```bash
npm i -g grill-board
grill-board --version
```

## Database

- Default path: `~/.local/share/grill-board/grill-board.db`
- Override with `GRILL_BOARD_DB`:

```bash
GRILL_BOARD_DB=/tmp/grill-scratch.db npx grill-board
```

The first boot creates the file, runs migrations, and imports a seed topic.
Delete the file and the next boot rebuilds it.

## MCP tools

| Tool | Purpose |
|---|---|
| `list_topics` | Every topic with status, counts and progress. |
| `get_topic` | Full topic state: rounds, questions, progress. |
| `create_topic` | New topic from title, context and categories. |
| `update_topic` | Edit title, context or categories. |
| `archive_topic` | Archive or un-archive a topic. |
| `create_round` | Open a new round on a topic. |
| `add_questions` | Batch-add questions to a round. |
| `update_question` | Edit question text, recommendation, options, category or note. |
| `set_question_status` | Move to `open` / `answered` / `suspended` / `pending_facts`. |
| `answer_question` | Record an answer; flips status to `answered`. |
| `list_pending_questions` | Everything still `open`, for one topic or all. |
| `export_answers` | A topic's answers as Markdown or JSON. |

## License

[FSL-1.1-MIT](LICENSE) — Functional Source License, Version 1.1, MIT Future License.
