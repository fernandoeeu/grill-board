# Grill Board

A web board where an agent posts rounds of grilling questions and a human answers them at their own pace, over an embedded MCP server.

## Language

**Topic**:
One grill: a subject under interrogation, with its rounds, questions and progress.
_Avoid_: Session, board (the board is the app surface, not one topic)

**Round**:
One wave of questions posted together by the agent. The unit the board is grouped and navigated by.

**Question**:
A single decision put to the human, belonging to one round and labeled with one category.

**Category**:
A label on a question. Metadata only — shown on the card and in the hover card; it does not group or filter the board.
_Avoid_: Section (categories no longer form board sections)

**Settled**:
The collapsible sidebar group holding archived topics.
_Avoid_: Archived (as a UI label)

**Round Navigator**:
The floating minimap on the left edge of the topic content: a wide line per round, short lines per question, colored by question status, with hover previews, scroll-spy, and click-to-scroll.
_Avoid_: Round filter, chips (removed)

**Hover Card**:
The popover shown when hovering a sidebar topic item: full title, context, categories, progress, round count, created/updated dates.
