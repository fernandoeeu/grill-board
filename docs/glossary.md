# Glossary — Distribution Vocabulary

Terms used across ADRs, CLI output, and documentation for the Grill Board distribution.

| Term | Definition |
|------|-----------|
| **Grill Board** | The web application that hosts grill sessions. Runs locally, serves a UI for the user and an MCP endpoint for agents. |
| **grill** | A structured interview where an agent asks pointed questions to stress-test a plan, decision, or idea. The user answers in the board; the agent reads the answers and fires the next round. |
| **topic** | A named subject under investigation on the board. A topic contains one or more rounds of questions. |
| **round** | One batch of questions the agent posts to a topic. After the user answers, the agent may fire another round based on the responses. |
| **question** | A single prompt within a round, displayed as a card on the board. May carry a recommendation and one or more pills. |
| **recommendation** | The agent's suggested answer to a question, shown alongside the pills. Informational, not binding. |
| **pill** (option) | A selectable choice attached to a question. The user clicks a pill to answer. Named for its rounded UI shape. |
| **MCP endpoint** | The Model Context Protocol HTTP endpoint the board exposes (e.g., `http://localhost:3000/mcp`). Agents use it to create topics, post questions, and read answers. |
| **bin harness** | The ~20-line Node script (`bin/grill-board.js`) that calls `http.createServer`, imports the TanStack Start fetch handler, and serves static assets. The only runtime entry point for the published package. |
| **data dir** | The directory where the SQLite database lives. Defaults to `~/.local/share/grill-board/` (XDG), overridable via `GRILL_BOARD_DB`. |
| **first boot** | The first time the app runs with an empty database. Triggers the seed, shell-alias offer, and MCP registration offer. |
| **seed** | The initial data inserted on first boot: a tutorial topic that teaches the grill flow. |
| **tutorial topic** | The seed topic that walks a new user through rounds, pills, and agent integration by example. |
| **alias snippet** | The shell-specific command (zsh/bash/fish) printed on first run so the user can type `grill-board` directly. Appended to the rc file only with explicit consent. |
