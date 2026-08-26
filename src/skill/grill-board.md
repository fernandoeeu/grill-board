# grill-board

Use the Grill Board MCP server to run structured decision-grilling sessions.

## When to use

When you need to surface every assumption, gap, or open question about a
technical decision before committing to it. The board gives the human a visual
UI to answer at their own pace; you drive the questions through MCP tools.

## Workflow

1. **Create a topic** (`create_topic`) with a title, context, and ordered
   categories that group the questions on the board.
2. **Create a round** (`create_round`) to hold the first wave of questions.
3. **Add questions** (`add_questions`) in a single batched call. Include your
   recommendation and quick-pick options where useful.
4. **Wait** for the human to answer on the board or in chat. Poll with
   `list_pending_questions`; read answers with `get_topic`.
5. **Iterate** — open a new round for follow-up questions based on the answers.
6. **Close** with a confirmation round (`kind: 'confirmation'`) that carries
   your synthesis and one gate question offering the next step.
7. **Export** the final answers with `export_answers`.

## Available tools

| Tool | Purpose |
|---|---|
| `list_topics` | List all grill topics with progress |
| `get_topic` | Full state of one topic |
| `create_topic` | Start a new grill |
| `update_topic` | Edit topic title, context, or categories |
| `archive_topic` | Archive or un-archive a topic |
| `create_round` | Open a new round of questions |
| `add_questions` | Batch-add questions to a round |
| `update_question` | Edit question content |
| `set_question_status` | Move a question between statuses |
| `answer_question` | Record an answer |
| `list_pending_questions` | Questions still waiting on the human |
| `export_answers` | Export all recorded answers |

## Tips

- One question per card. No compound asks.
- Always read `get_topic` before editing anything.
- Use `recommendation` to state your opinion; it renders as its own panel.
- Use `options` for quick-pick answers; mark one with `recommendedOption`.
- Suspended and pending_facts questions drop out of progress counters.
- Categories must be declared on the topic before questions can use them.
