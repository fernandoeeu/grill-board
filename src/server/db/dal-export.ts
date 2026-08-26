/**
 * Read-only data access for cross-topic queues and exports.
 *
 * Both functions are shaped for an agent reading them through MCP: no nulls,
 * no redundant nesting, stable ordering.
 */

import type { AnsweredVia, PendingQuestion } from "@/lib/types";
import { getDb } from "./connection";
import { topicNotFound } from "./errors";
import { mapQuestionRow, type QuestionRow } from "./mappers";

/** A question row carried with the title of its topic. */
interface PendingRow extends QuestionRow {
  topic_title: string;
}

/** One entry of the JSON export. */
interface ExportedAnswer {
  id: string;
  round: number;
  category: string;
  answer: string;
  answeredVia?: AnsweredVia;
}

const PENDING_SQL = `
  SELECT q.*, r.number AS round_number, t.title AS topic_title
  FROM questions q
  JOIN rounds r ON r.id = q.round_id
  JOIN topics t ON t.id = q.topic_id
  WHERE (q.status = 'open' OR (:includePendingFacts = 1 AND q.status = 'pending_facts'))
    AND (:topicId IS NULL OR q.topic_id = :topicId)
  ORDER BY q.topic_id, r.number, q.position, q.created_at
`;

const ANSWERED_SQL = `
  SELECT q.*, r.number AS round_number
  FROM questions q
  JOIN rounds r ON r.id = q.round_id
  WHERE q.topic_id = ?
    AND q.status = 'answered'
    AND q.answer IS NOT NULL
    AND q.answer <> ''
  ORDER BY r.number, q.position, q.created_at
`;

/** Read a topic title, or throw the agent-helpful not-found error. */
function requireTopicTitle(topicId: string): string {
  const row = getDb()
    .prepare<[string], { title: string }>("SELECT title FROM topics WHERE id = ?")
    .get(topicId);
  if (!row) {
    throw topicNotFound(topicId);
  }
  return row.title;
}

/**
 * Every question still waiting on the human: `open` always, `pending_facts`
 * too when asked. Covers all topics — archived ones included — unless a
 * `topicId` narrows it.
 */
export function listPendingQuestions(opts?: {
  topicId?: string;
  includePendingFacts?: boolean;
}): PendingQuestion[] {
  const topicId = opts?.topicId;
  if (topicId !== undefined) requireTopicTitle(topicId);

  const rows = getDb()
    .prepare<{ includePendingFacts: number; topicId: string | null }, PendingRow>(PENDING_SQL)
    .all({
      includePendingFacts: opts?.includePendingFacts ? 1 : 0,
      topicId: topicId ?? null,
    });

  return rows.map((row) => ({
    topicId: row.topic_id,
    topicTitle: row.topic_title,
    question: mapQuestionRow(row),
  }));
}

/**
 * Recorded answers of a topic, as Markdown (default) or compact JSON.
 * Only `answered` questions carrying a non-empty answer are exported;
 * drafts are not answers.
 */
export function exportAnswers(topicId: string, format: "markdown" | "json" = "markdown"): string {
  const title = requireTopicTitle(topicId);
  const rows = getDb().prepare<[string], QuestionRow>(ANSWERED_SQL).all(topicId);
  const questions = rows.map(mapQuestionRow);

  if (format === "json") {
    const answers: ExportedAnswer[] = questions.map((q) => ({
      id: q.id,
      round: q.roundNumber,
      category: q.category,
      answer: q.answer ?? "",
      ...(q.answeredVia ? { answeredVia: q.answeredVia } : {}),
    }));
    return JSON.stringify({ topicId, title, answers });
  }

  const heading = `## Answers — ${title}`;
  if (questions.length === 0) return heading;
  const lines = questions.map((q) => `- **${q.id}** (round ${q.roundNumber}): ${q.answer ?? ""}`);
  return [heading, "", ...lines].join("\n");
}
