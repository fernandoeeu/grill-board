# Grill Board

A **grill** is a structured interrogation. An agent questions a human about a plan in rounds, the human answers on a visual board, the agent reads the answers and fires the next round. Grill Board runs many grills at once, stores everything in a local SQLite file, and exposes every action as an MCP tool.

## Send this to your LLM agent

Paste this prompt into your agent (Claude Code, Cursor, Windsurf, or any MCP-capable client):

```
Read the Grill Board repository at https://github.com/fernandoeeu/grill-board
(the full README, package.json, and dist/bin/), then explain to me how Grill Board
works. After the explanation, ask me if I want to install it.
```

The rest of this README contains everything the agent needs.

## Prerequisites

- **Node.js >= 22** (the package declares `engines.node >= 22`)
- **npm**, **pnpm**, or any npm-compatible package manager

No Docker, no cloud account, no global install required.

## Installation

### 1. Run the server

```bash
npx grill-board
```

The app starts on `http://localhost:3000`. The MCP endpoint lives at `/mcp` on the same port. If port 3000 is busy, the server binds to a free port automatically.

### 2. Register the MCP server and install the skill

```bash
npx grill-board init
```

`init` detects agent clients on your machine (Claude Code today; more planned) and does two things:

1. Writes a `grill-board` MCP server entry into the client's config (e.g. `~/.claude.json`).
2. Copies the bundled `grill-board.md` skill file into the client's skill directory (e.g. `~/.claude/skills/`).

Both steps are idempotent. Running `init` again skips what is already configured.

### Manual MCP registration

If you prefer to register by hand:

```bash
claude mcp add grill-board --command npx --args grill-board
```

Or add to your MCP config file directly:

```json
{
  "mcpServers": {
    "grill-board": {
      "command": "npx",
      "args": ["grill-board"]
    }
  }
}
```

## Daily use

### Start the server

```bash
npx grill-board
```

Or, if installed globally:

```bash
npm i -g grill-board
grill-board
```

The server prints a shell-alias hint on first launch. Adding `alias grill="npx grill-board"` to your shell config saves keystrokes.

### Run a grill session

The agent drives the grill through MCP tools. A typical flow:

1. `create_topic` with a title, context, and ordered categories.
2. `create_round` opens a wave of questions on the topic.
3. `add_questions` in a single batched call. Include a recommendation and quick-pick options where useful.
4. The human answers on the board UI or in chat. The agent polls with `list_pending_questions` and reads results with `get_topic`.
5. Open new rounds for follow-up questions based on answers.
6. A confirmation round (`kind: 'confirmation'`) carries the agent's synthesis and a gate question for the next step.
7. `export_answers` produces the final answers as Markdown or JSON.

### Available MCP tools

| Tool                     | Purpose                                                        |
| ------------------------ | -------------------------------------------------------------- |
| `list_topics`            | Every topic with status, counts, and progress.                 |
| `get_topic`              | Full topic state: rounds, questions, progress.                 |
| `create_topic`           | New topic from title, context, and categories.                 |
| `update_topic`           | Edit title, context, or categories.                            |
| `archive_topic`          | Archive or un-archive a topic.                                 |
| `create_round`           | Open a new round on a topic.                                   |
| `add_questions`          | Batch-add questions to a round.                                |
| `update_question`        | Edit question text, recommendation, options, category, or note.|
| `set_question_status`    | Move to `open` / `answered` / `suspended` / `pending_facts`.   |
| `answer_question`        | Record an answer; flips status to `answered`.                  |
| `list_pending_questions` | Everything still `open`, for one topic or all.                 |
| `export_answers`         | A topic's answers as Markdown or JSON.                         |

### Custom port

```bash
npx grill-board --port 4000
```

Or via environment variable:

```bash
PORT=4000 npx grill-board
```

### Database

- Default path: `~/.local/share/grill-board/grill-board.db`
- Override with `GRILL_BOARD_DB`:

```bash
GRILL_BOARD_DB=/tmp/grill-scratch.db npx grill-board
```

The first boot creates the file, runs migrations, and imports a seed topic. Delete the file and the next boot rebuilds it.

### Upgrade

```bash
npx grill-board@latest
```

### Release (maintainers)

```bash
git tag vX.Y.Z && git push origin vX.Y.Z
```

CI publishes to npm automatically.

## License

[FSL-1.1-MIT](LICENSE), Functional Source License, Version 1.1, MIT Future License.
