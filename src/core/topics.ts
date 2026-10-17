/**
 * Data access for topics and rounds.
 *
 * The only place that speaks SQL about the `topics` and `rounds` tables.
 * Every function is synchronous and takes the host connection first.
 */

import type {
  Question,
  Round,
  RoundKind,
  TopicDetail,
  TopicStatus,
  TopicSummary,
} from "./types.js";
import type { Db } from "./sqlite.js";
import { topicIdTaken, topicNotFound } from "./errors.js";
import {
  mapQuestionRow,
  mapRoundRow,
  type QuestionRow,
  type RoundRow,
  type TopicRow,
} from "./mappers.js";
import {
  computeProgress,
  nextRoundNumber,
  roundIdFor,
  summarizeTopic,
  uniqueTopicId,
} from "./rules.js";

const TOPIC_COLUMNS = "id, title, context, categories, status, created_at, updated_at";

/** Bind object for a topic INSERT: every column key must be present. */
interface TopicInsert {
  id: string;
  title: string;
  context: string | null;
  categories: string;
  created_at: number;
  updated_at: number;
}

/** Bind object for a round INSERT. */
interface RoundInsert {
  id: string;
  topic_id: string;
  number: number;
  title: string | null;
  kind: RoundKind;
  synthesis: string | null;
  created_at: number;
}

/** Optional extras for `createRound`; a plain round needs none of them. */
export interface NewRound {
  title?: string;
  kind?: RoundKind;
  /** Markdown consolidation; only meaningful on confirmation rounds. */
  synthesis?: string;
}

/**
 * All topics, newest activity first, each with its computed progress.
 *
 * Two queries, never one per topic: one for the topics, one for every
 * question that belongs to them.
 */
export function listTopics(db: Db, status?: TopicStatus): TopicSummary[] {
  const filter = status ?? null;

  const topicRows = db
    .prepare<{ topic_status: string | null }, TopicRow>(
      `SELECT ${TOPIC_COLUMNS}
         FROM topics
        WHERE (@topic_status IS NULL OR status = @topic_status)
        ORDER BY updated_at DESC, id`,
    )
    .all({ topic_status: filter });

  const questionRows = db
    .prepare<{ topic_status: string | null }, QuestionRow>(
      `SELECT q.*, r.number AS round_number
         FROM questions q
         JOIN rounds r ON r.id = q.round_id
         JOIN topics t ON t.id = q.topic_id
        WHERE (@topic_status IS NULL OR t.status = @topic_status)
        ORDER BY r.number, q.position, q.created_at`,
    )
    .all({ topic_status: filter });

  const byTopic = new Map<string, Question[]>();
  for (const row of questionRows) {
    const question = mapQuestionRow(row);
    const bucket = byTopic.get(question.topicId);
    if (bucket) bucket.push(question);
    else byTopic.set(question.topicId, [question]);
  }

  const roundRows = db
    .prepare<{ topic_status: string | null }, { topic_id: string; count: number }>(
      `SELECT r.topic_id AS topic_id, COUNT(*) AS count
         FROM rounds r
         JOIN topics t ON t.id = r.topic_id
        WHERE (@topic_status IS NULL OR t.status = @topic_status)
        GROUP BY r.topic_id`,
    )
    .all({ topic_status: filter });
  const roundCounts = new Map(roundRows.map((row) => [row.topic_id, row.count]));

  return topicRows.map((row) => {
    const questions = byTopic.get(row.id) ?? [];
    return summarizeTopic(
      {
        id: row.id,
        title: row.title,
        context: optionalText(row.context),
        categories: parseCategories(row.categories),
        status: toTopicStatus(row.status),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
      questions,
      roundCounts.get(row.id) ?? 0,
    );
  });
}

/** Full state of one topic, or `null` when there is no such topic. Three queries. */
export function getTopic(db: Db, topicId: string): TopicDetail | null {
  const row = db
    .prepare<[string], TopicRow>(`SELECT ${TOPIC_COLUMNS} FROM topics WHERE id = ?`)
    .get(topicId);
  if (!row) return null;

  const rounds = db
    .prepare<[string], RoundRow>("SELECT * FROM rounds WHERE topic_id = ? ORDER BY number")
    .all(topicId)
    .map((roundRow) => mapRoundRow(roundRow));

  const questions = db
    .prepare<[string], QuestionRow>(
      `SELECT q.*, r.number AS round_number
         FROM questions q
         JOIN rounds r ON r.id = q.round_id
        WHERE q.topic_id = ?
        ORDER BY r.number, q.position, q.created_at`,
    )
    .all(topicId)
    .map((questionRow) => mapQuestionRow(questionRow));

  const detail: TopicDetail = {
    id: row.id,
    title: row.title,
    categories: parseCategories(row.categories),
    status: toTopicStatus(row.status),
    rounds,
    questions,
    progress: computeProgress(questions),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  const context = optionalText(row.context);
  if (context !== undefined) detail.context = context;
  return detail;
}

/**
 * Create a topic. Without an explicit id the title is slugified and
 * de-duplicated (`my-topic`, `my-topic-2`, …); an explicit id that is already
 * taken is an error.
 */
export function createTopic(
  db: Db,
  input: {
    id?: string;
    title: string;
    context?: string;
    categories: string[];
  },
): TopicDetail {
  if (input.id !== undefined && topicExists(db, input.id)) {
    throw topicIdTaken(input.id);
  }

  const now = Date.now();
  const id = input.id ?? uniqueTopicId(input.title, (candidate) => topicExists(db, candidate), now);
  const values: TopicInsert = {
    id,
    title: input.title,
    context: input.context ?? null,
    categories: JSON.stringify(input.categories),
    created_at: now,
    updated_at: now,
  };

  db.prepare<TopicInsert>(
    `INSERT INTO topics (id, title, context, categories, status, created_at, updated_at)
     VALUES (@id, @title, @context, @categories, 'active', @created_at, @updated_at)`,
  ).run(values);

  return requireTopic(db, id);
}

/** Edit title / context / categories. Absent keys are left untouched. */
export function updateTopic(
  db: Db,
  topicId: string,
  patch: { title?: string; context?: string; categories?: string[] },
): TopicDetail {
  const assignments: string[] = [];
  const values: Record<string, string | number | null> = { id: topicId, updated_at: Date.now() };

  if (patch.title !== undefined) {
    assignments.push("title = @title");
    values.title = patch.title;
  }
  if (patch.context !== undefined) {
    assignments.push("context = @context");
    values.context = patch.context;
  }
  if (patch.categories !== undefined) {
    assignments.push("categories = @categories");
    values.categories = JSON.stringify(patch.categories);
  }

  if (assignments.length > 0) {
    db.prepare<Record<string, string | number | null>>(
      `UPDATE topics SET ${assignments.join(", ")}, updated_at = @updated_at WHERE id = @id`,
    ).run(values);
  }

  return requireTopic(db, topicId);
}

/** Archive or un-archive a topic. */
export function setTopicArchived(db: Db, topicId: string, archived: boolean): TopicDetail {
  db.prepare<{ id: string; status: TopicStatus; updated_at: number }>(
    "UPDATE topics SET status = @status, updated_at = @updated_at WHERE id = @id",
  ).run({ id: topicId, status: archived ? "archived" : "active", updated_at: Date.now() });

  return requireTopic(db, topicId);
}

/** Open the next round on a topic. The number is `max(number) + 1`, starting at 1. */
export function createRound(db: Db, topicId: string, extras: NewRound = {}): Round {
  const { title, kind = "grill", synthesis } = extras;
  const now = Date.now();

  const insert = db.transaction((): RoundRow => {
    if (!topicExists(db, topicId)) {
      throw topicNotFound(topicId);
    }

    const number = nextRoundNumber(
      db
        .prepare<[string], { number: number }>("SELECT number FROM rounds WHERE topic_id = ?")
        .all(topicId)
        .map((row) => row.number),
    );
    const id = roundIdFor(topicId, number);

    const values: RoundInsert = {
      id,
      topic_id: topicId,
      number,
      title: title ?? null,
      kind,
      synthesis: synthesis ?? null,
      created_at: now,
    };
    db.prepare<RoundInsert>(
      `INSERT INTO rounds (id, topic_id, number, title, kind, synthesis, created_at)
       VALUES (@id, @topic_id, @number, @title, @kind, @synthesis, @created_at)`,
    ).run(values);

    db.prepare<[number, string]>("UPDATE topics SET updated_at = ? WHERE id = ?").run(now, topicId);

    const row = db.prepare<[string], RoundRow>("SELECT * FROM rounds WHERE id = ?").get(id);
    if (!row) throw new Error(`round '${id}' vanished right after being created`);
    return row;
  });

  return mapRoundRow(insert());
}

/* ------------------------------------------------------------------ helpers */

function requireTopic(db: Db, topicId: string): TopicDetail {
  const topic = getTopic(db, topicId);
  if (!topic) throw topicNotFound(topicId);
  return topic;
}

function topicExists(db: Db, topicId: string): boolean {
  return (
    db.prepare<[string], { id: string }>("SELECT id FROM topics WHERE id = ?").get(topicId) !==
    undefined
  );
}

/** SQL NULL (and the empty string) mean "absent" — the domain type omits the key. */
function optionalText(value: string | null | undefined): string | undefined {
  return value === null || value === undefined || value === "" ? undefined : value;
}

/** The `status` CHECK constraint keeps this total; anything else reads as active. */
function toTopicStatus(value: string): TopicStatus {
  return value === "archived" ? "archived" : "active";
}

function parseCategories(raw: string): string[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((entry): entry is string => typeof entry === "string");
}
