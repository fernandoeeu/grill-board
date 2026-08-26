/**
 * Data-access layer — questions.
 *
 * Every write to the `questions` table goes through this module. It is the
 * only place, together with the other `dal-*` files, that speaks SQL.
 *
 * Conventions shared with the rest of the layer:
 * - question ids are short (`q1`) and unique inside a topic; the primary key
 *   is the pair `(topic_id, id)`, so every statement is keyed by both;
 * - a mutation bumps `questions.updated_at` and the parent `topics.updated_at`;
 * - absent optional fields are stored as SQL NULL and dropped by the mappers,
 *   so domain objects never carry nulls.
 */

import type { Database as SqliteDatabase } from "better-sqlite3";

import type { AnsweredVia, Draft, NewQuestion, Question, QuestionStatus } from "@/lib/types";

import { getDb } from "./connection";
import { questionNotFound, roundNotFound, topicNotFound } from "./errors";
import { mapQuestionRow, type QuestionRow } from "./mappers";

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

function requireTopic(db: SqliteDatabase, topicId: string): void {
  const row = db
    .prepare<[string], { id: string }>("SELECT id FROM topics WHERE id = ?")
    .get(topicId);
  if (!row) {
    throw topicNotFound(topicId);
  }
}

/** Reads one question, or throws with a message an agent can act on. */
function readQuestion(db: SqliteDatabase, topicId: string, questionId: string): Question {
  const row = db
    .prepare<[string, string], QuestionRow>(`${QUESTION_SELECT} WHERE q.topic_id = ? AND q.id = ?`)
    .get(topicId, questionId);
  if (!row) {
    requireTopic(db, topicId);
    throw questionNotFound(topicId, questionId);
  }
  return mapQuestionRow(row);
}

function touchTopic(db: SqliteDatabase, topicId: string, now: number): void {
  db.prepare<[number, string]>("UPDATE topics SET updated_at = ? WHERE id = ?").run(now, topicId);
}

/** Empty and whitespace-only text is stored as NULL, never as ''. */
function textOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.trim() ? value : null;
}

/** An empty option list is stored as NULL so the mapper omits the field. */
function optionsOrNull(options: string[] | null | undefined): string | null {
  if (!options || options.length === 0) return null;
  return JSON.stringify(options);
}

/** A recommended option is only meaningful when it names one of the pills. */
function checkRecommendedOption(
  recommendedOption: string | null,
  options: string[] | undefined,
  questionId: string,
): void {
  if (recommendedOption === null) return;
  if (!options || !options.includes(recommendedOption)) {
    throw new Error(
      `recommendedOption '${recommendedOption}' is not one of the options of question ` +
        `'${questionId}'; it must match an entry of 'options' verbatim`,
    );
  }
}

/** A draft with no picked option and no text is not a draft: it is NULL. */
function draftOrNull(draft: Draft | null | undefined): string | null {
  if (!draft) return null;
  const value: Draft = {};
  if (draft.option && draft.option.trim()) value.option = draft.option;
  if (draft.text && draft.text.trim()) value.text = draft.text;
  if (value.option === undefined && value.text === undefined) return null;
  return JSON.stringify(value);
}

/**
 * Adds questions to an existing round, in one transaction.
 *
 * Positions are appended after the topic's last question, in input order.
 * A question without an explicit id gets the next unused `q<n>` of the topic.
 * Returns the created questions in input order.
 */
export function addQuestions(topicId: string, roundId: string, items: NewQuestion[]): Question[] {
  const db = getDb();
  requireTopic(db, topicId);

  const round = db
    .prepare<[string, string], { id: string }>(
      "SELECT id FROM rounds WHERE id = ? AND topic_id = ?",
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
    const taken = new Set(
      db
        .prepare<[string], { id: string }>("SELECT id FROM questions WHERE topic_id = ?")
        .all(topicId)
        .map((row) => row.id),
    );
    const last = db
      .prepare<[string], { max_position: number | null }>(
        "SELECT MAX(position) AS max_position FROM questions WHERE topic_id = ?",
      )
      .get(topicId);

    const now = Date.now();
    let position = (last?.max_position ?? -1) + 1;
    let counter = 1;
    const ids: string[] = [];

    for (const item of items) {
      let id = item.id;
      if (id === undefined) {
        while (taken.has(`q${counter}`)) counter += 1;
        id = `q${counter}`;
      } else if (taken.has(id)) {
        throw new Error(
          `question '${id}' already exists in topic '${topicId}'; use update_question`,
        );
      }
      taken.add(id);
      ids.push(id);

      const recommendedOption = textOrNull(item.recommendedOption);
      checkRecommendedOption(recommendedOption, item.options, id);

      insert.run({
        id,
        topic_id: topicId,
        round_id: roundId,
        category: item.category,
        status: item.status ?? "open",
        text: item.text,
        recommendation: textOrNull(item.recommendation),
        recommended_option: recommendedOption,
        options: optionsOrNull(item.options),
        note: textOrNull(item.note),
        position,
        created_at: now,
        updated_at: now,
      });
      position += 1;
    }

    touchTopic(db, topicId, now);

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
  topicId: string,
  questionId: string,
  patch: {
    text?: string;
    recommendation?: string | null;
    recommendedOption?: string | null;
    options?: string[] | null;
    category?: string;
    note?: string | null;
  },
): Question {
  const db = getDb();

  const run = db.transaction((): Question => {
    const current = readQuestion(db, topicId, questionId); // throws NotFoundError
    const assignments: string[] = [];
    const params: Array<string | number | null> = [];

    if (patch.text !== undefined) {
      assignments.push("text = ?");
      params.push(patch.text);
    }
    if (patch.category !== undefined) {
      assignments.push("category = ?");
      params.push(patch.category);
    }
    if (patch.recommendation !== undefined) {
      assignments.push("recommendation = ?");
      params.push(textOrNull(patch.recommendation));
    }
    if (patch.options !== undefined) {
      assignments.push("options = ?");
      params.push(optionsOrNull(patch.options));
    }
    if (patch.note !== undefined) {
      assignments.push("note = ?");
      params.push(textOrNull(patch.note));
    }

    // The recommended option must always name one of the effective options.
    // Setting it validates against the (new or kept) list; replacing the list
    // without re-stating it silently drops a marker the list no longer holds.
    const effectiveOptions =
      patch.options !== undefined ? (patch.options ?? undefined) : current.options;
    if (patch.recommendedOption !== undefined) {
      const next = textOrNull(patch.recommendedOption);
      checkRecommendedOption(next, effectiveOptions, questionId);
      assignments.push("recommended_option = ?");
      params.push(next);
    } else if (
      patch.options !== undefined &&
      current.recommendedOption !== undefined &&
      !(effectiveOptions ?? []).includes(current.recommendedOption)
    ) {
      assignments.push("recommended_option = ?");
      params.push(null);
    }

    // Nothing to change: read it back instead of bumping the timestamps.
    if (assignments.length === 0) return current;

    const now = Date.now();
    assignments.push("updated_at = ?");
    params.push(now);

    db.prepare<Array<string | number | null>>(
      `UPDATE questions SET ${assignments.join(", ")}
        WHERE topic_id = ? AND id = ?`,
    ).run(...params, topicId, questionId);
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
  topicId: string,
  questionId: string,
  status: QuestionStatus,
  note?: string,
): Question {
  const db = getDb();
  const now = Date.now();

  const run = db.transaction((): Question => {
    const result =
      note === undefined
        ? db
            .prepare<[QuestionStatus, number, string, string]>(
              `UPDATE questions SET status = ?, updated_at = ?
                WHERE topic_id = ? AND id = ?`,
            )
            .run(status, now, topicId, questionId)
        : db
            .prepare<[QuestionStatus, string | null, number, string, string]>(
              `UPDATE questions SET status = ?, note = ?, updated_at = ?
                WHERE topic_id = ? AND id = ?`,
            )
            .run(status, textOrNull(note), now, topicId, questionId);
    if (result.changes === 0) {
      readQuestion(db, topicId, questionId); // throws NotFoundError
    }
    touchTopic(db, topicId, now);
    return readQuestion(db, topicId, questionId);
  });

  return run();
}

/**
 * Records an answer: sets the answer and its provenance, flips the status to
 * `answered` and drops the draft. Quick-pick options are kept.
 */
export function answerQuestion(
  topicId: string,
  questionId: string,
  answer: string,
  answeredVia: AnsweredVia,
): Question {
  const db = getDb();
  const now = Date.now();

  const run = db.transaction((): Question => {
    const result = db
      .prepare<[string, AnsweredVia, number, string, string]>(
        `UPDATE questions
            SET answer = ?, answered_via = ?, status = 'answered',
                draft = NULL, updated_at = ?
          WHERE topic_id = ? AND id = ?`,
      )
      .run(answer, answeredVia, now, topicId, questionId);
    if (result.changes === 0) {
      readQuestion(db, topicId, questionId); // throws NotFoundError
    }
    touchTopic(db, topicId, now);
    return readQuestion(db, topicId, questionId);
  });

  return run();
}

/**
 * Saves the auto-saved draft answer. `null` — or a draft with no option and no
 * text — clears it, which keeps the progress count honest.
 */
export function saveDraft(topicId: string, questionId: string, draft: Draft | null): Question {
  const db = getDb();
  const now = Date.now();

  const run = db.transaction((): Question => {
    const result = db
      .prepare<[string | null, number, string, string]>(
        `UPDATE questions SET draft = ?, updated_at = ?
          WHERE topic_id = ? AND id = ?`,
      )
      .run(draftOrNull(draft), now, topicId, questionId);
    if (result.changes === 0) {
      readQuestion(db, topicId, questionId); // throws NotFoundError
    }
    touchTopic(db, topicId, now);
    return readQuestion(db, topicId, questionId);
  });

  return run();
}

/**
 * Clears every unsubmitted draft of a topic. Only `open` questions that carry
 * a draft are touched. Returns how many were cleared.
 */
export function clearDrafts(topicId: string): number {
  const db = getDb();
  requireTopic(db, topicId);
  const now = Date.now();

  const run = db.transaction((): number => {
    const result = db
      .prepare<[number, string]>(
        `UPDATE questions SET draft = NULL, updated_at = ?
          WHERE topic_id = ? AND draft IS NOT NULL AND status = 'open'`,
      )
      .run(now, topicId);
    if (result.changes > 0) touchTopic(db, topicId, now);
    return result.changes;
  });

  return run();
}
