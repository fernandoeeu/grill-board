/**
 * Data-access layer — questions.
 *
 * Every write to the `questions` table goes through this module. It is the
 * only place, together with `topics.ts` and `export.ts`, that speaks SQL. The
 * rules themselves (ids, normalisation, recommended option, transitions) live
 * in `rules.ts`; this module reads rows, applies a rule, writes the result.
 *
 * Conventions shared with the rest of the layer:
 * - question ids are short (`q1`) and unique inside a topic; the primary key
 *   is the pair `(topic_id, id)`, so every statement is keyed by both;
 * - a mutation bumps `questions.updated_at` and the parent `topics.updated_at`;
 * - absent optional fields are stored as SQL NULL and dropped by the mappers,
 *   so domain objects never carry nulls.
 */

import type { AnsweredVia, Draft, NewQuestion, Question, QuestionStatus } from "./types.js";

import type { Db } from "./sqlite.js";
import { questionNotFound, roundNotFound, topicNotFound } from "./errors.js";
import { mapQuestionRow, type QuestionRow } from "./mappers.js";
import {
  applyAnswer,
  applyClearDraft,
  applyDraft,
  applyQuestionPatch,
  applyStatus,
  buildQuestions,
  canClearDraft,
  nextPosition,
  type QuestionPatch,
} from "./rules.js";

/** Shared shape of every question read: the row plus its round number. */
const QUESTION_SELECT = `
  SELECT q.*, r.number AS round_number
    FROM questions q
    JOIN rounds r ON r.id = q.round_id
`;

/** Bind object for an insert; every column key must be present. */
interface QuestionInsert {
  id: string;
  topic_id: string;
  round_id: string;
  category: string;
  status: QuestionStatus;
  text: string;
  recommendation: string | null;
  recommended_option: string | null;
  options: string | null;
  note: string | null;
  position: number;
  created_at: number;
  updated_at: number;
}

function requireTopic(db: Db, topicId: string): void {
  const row = db
    .prepare<[string], { id: string }>("SELECT id FROM topics WHERE id = ?")
    .get(topicId);
  if (!row) {
    throw topicNotFound(topicId);
  }
}

/** Reads one question, or throws with a message an agent can act on. */
function readQuestion(db: Db, topicId: string, questionId: string): Question {
  const row = db
    .prepare<[string, string], QuestionRow>(`${QUESTION_SELECT} WHERE q.topic_id = ? AND q.id = ?`)
    .get(topicId, questionId);
  if (!row) {
    requireTopic(db, topicId);
    throw questionNotFound(topicId, questionId);
  }
  return mapQuestionRow(row);
}

function touchTopic(db: Db, topicId: string, now: number): void {
  db.prepare<[number, string]>("UPDATE topics SET updated_at = ? WHERE id = ?").run(now, topicId);
}

/** SQL NULL for an absent value. */
function orNull<T>(value: T | undefined): T | null {
  return value === undefined ? null : value;
}

/** Bind values of a full question write, from the domain object. */
interface QuestionWrite {
  topic_id: string;
  id: string;
  category: string;
  status: QuestionStatus;
  text: string;
  recommendation: string | null;
  recommended_option: string | null;
  options: string | null;
  note: string | null;
  answer: string | null;
  answered_via: AnsweredVia | null;
  draft: string | null;
  updated_at: number;
}

/** Writes every mutable column of `question` (the rules already produced it). */
function writeQuestion(db: Db, question: Question): void {
  db.prepare<QuestionWrite>(
    `UPDATE questions
        SET category = @category, status = @status, text = @text,
            recommendation = @recommendation, recommended_option = @recommended_option,
            options = @options, note = @note, answer = @answer,
            answered_via = @answered_via, draft = @draft, updated_at = @updated_at
      WHERE topic_id = @topic_id AND id = @id`,
  ).run({
    topic_id: question.topicId,
    id: question.id,
    category: question.category,
    status: question.status,
    text: question.text,
    recommendation: orNull(question.recommendation),
    recommended_option: orNull(question.recommendedOption),
    options: question.options ? JSON.stringify(question.options) : null,
    note: orNull(question.note),
    answer: orNull(question.answer),
    answered_via: orNull(question.answeredVia),
    draft: question.draft ? JSON.stringify(question.draft) : null,
    updated_at: question.updatedAt,
  });
}

/** Read, transform with a rule, write, touch the topic, read back. One transaction. */
function transition(
  db: Db,
  topicId: string,
  questionId: string,
  apply: (current: Question, now: number) => Question,
): Question {
  const run = db.transaction((): Question => {
    const now = Date.now();
    const next = apply(readQuestion(db, topicId, questionId), now); // throws NotFoundError
    writeQuestion(db, next);
    touchTopic(db, topicId, now);
    return readQuestion(db, topicId, questionId);
  });
  return run();
}

/**
 * Adds questions to an existing round, in one transaction.
 *
 * Positions are appended after the topic's last question, in input order.
 * A question without an explicit id gets the next unused `q<n>` of the topic.
 * Returns the created questions in input order.
 */
export function addQuestions(
  db: Db,
  topicId: string,
  roundId: string,
  items: NewQuestion[],
): Question[] {
  requireTopic(db, topicId);

  const round = db
    .prepare<[string, string], { id: string; number: number }>(
      "SELECT id, number FROM rounds WHERE id = ? AND topic_id = ?",
    )
    .get(roundId, topicId);
  if (!round) {
    throw roundNotFound(topicId, roundId);
  }

  if (items.length === 0) return [];

  const insert = db.prepare<QuestionInsert>(`
    INSERT INTO questions (id, topic_id, round_id, category, status, text,
                           recommendation, recommended_option, options, note,
                           position, created_at, updated_at)
    VALUES (@id, @topic_id, @round_id, @category, @status, @text,
            @recommendation, @recommended_option, @options, @note,
            @position, @created_at, @updated_at)
  `);

  const run = db.transaction((): Question[] => {
    const existing = db
      .prepare<[string], { id: string; position: number }>(
        "SELECT id, position FROM questions WHERE topic_id = ?",
      )
      .all(topicId);

    const now = Date.now();
    const questions = buildQuestions({
      topicId,
      round,
      items,
      takenIds: existing.map((row) => row.id),
      startPosition: nextPosition(existing.map((row) => row.position)),
      now,
    });

    for (const question of questions) {
      insert.run({
        id: question.id,
        topic_id: topicId,
        round_id: roundId,
        category: question.category,
        status: question.status,
        text: question.text,
        recommendation: orNull(question.recommendation),
        recommended_option: orNull(question.recommendedOption),
        options: question.options ? JSON.stringify(question.options) : null,
        note: orNull(question.note),
        position: question.position,
        created_at: now,
        updated_at: now,
      });
    }

    touchTopic(db, topicId, now);

    const ids = questions.map((question) => question.id);
    const placeholders = ids.map(() => "?").join(", ");
    const rows = db
      .prepare<string[], QuestionRow>(
        `${QUESTION_SELECT} WHERE q.topic_id = ? AND q.id IN (${placeholders})`,
      )
      .all(topicId, ...ids);
    const order = new Map(ids.map((id, index) => [id, index]));
    return rows.map(mapQuestionRow).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  });

  return run();
}

/**
 * Edits a question's content. Only the keys present in `patch` are written;
 * an explicit `null` clears the column, `undefined` leaves it untouched.
 */
export function updateQuestion(
  db: Db,
  topicId: string,
  questionId: string,
  patch: QuestionPatch,
): Question {
  const run = db.transaction((): Question => {
    const current = readQuestion(db, topicId, questionId); // throws NotFoundError
    const now = Date.now();
    const { question, changed } = applyQuestionPatch(current, patch, now);

    // Nothing to change: read it back instead of bumping the timestamps.
    if (!changed) return current;

    writeQuestion(db, question);
    touchTopic(db, topicId, now);
    return readQuestion(db, topicId, questionId);
  });

  return run();
}

/**
 * Moves a question to another status. A `note` given here REPLACES the stored
 * note; omitting it leaves the note as it was.
 */
export function setQuestionStatus(
  db: Db,
  topicId: string,
  questionId: string,
  status: QuestionStatus,
  note?: string,
): Question {
  return transition(db, topicId, questionId, (current, now) =>
    applyStatus(current, status, note, now),
  );
}

/**
 * Records an answer: sets the answer and its provenance, flips the status to
 * `answered` and drops the draft. Quick-pick options are kept.
 */
export function answerQuestion(
  db: Db,
  topicId: string,
  questionId: string,
  answer: string,
  answeredVia: AnsweredVia,
): Question {
  return transition(db, topicId, questionId, (current, now) =>
    applyAnswer(current, answer, answeredVia, now),
  );
}

/**
 * Saves the auto-saved draft answer. `null` — or a draft with no option and no
 * text — clears it, which keeps the progress count honest.
 */
export function saveDraft(
  db: Db,
  topicId: string,
  questionId: string,
  draft: Draft | null,
): Question {
  return transition(db, topicId, questionId, (current, now) => applyDraft(current, draft, now));
}

/**
 * Clears every unsubmitted draft of a topic. Only `open` questions that carry
 * a draft are touched. Returns how many were cleared.
 */
export function clearDrafts(db: Db, topicId: string): number {
  requireTopic(db, topicId);
  const now = Date.now();

  const run = db.transaction((): number => {
    const cleared = db
      .prepare<[string], QuestionRow>(`${QUESTION_SELECT} WHERE q.topic_id = ?`)
      .all(topicId)
      .map(mapQuestionRow)
      .filter(canClearDraft);
    for (const question of cleared) writeQuestion(db, applyClearDraft(question, now));
    if (cleared.length > 0) touchTopic(db, topicId, now);
    return cleared.length;
  });

  return run();
}
