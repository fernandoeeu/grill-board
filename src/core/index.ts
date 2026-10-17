/**
 * `grill-board/core` — the Grill Board as a library.
 *
 * The domain (topics, rounds, questions, answers, drafts, export), the schema
 * migrations and the twelve MCP tools, over a SQLite connection the host opens
 * and owns. No UI, no HTTP server, no file path, no auth: the local app is one
 * host of this module, and any other server can be another.
 *
 *     const db = new Database(file); // better-sqlite3, or bun:sqlite with { strict: true }
 *     migrate(db);
 *     const grill = createGrillCore(db);
 *     for (const tool of grillTools(grill)) host.register(tool);
 *
 * A host on another store (Convex, Postgres…) skips SQLite: it implements the
 * async `GrillStore` port on top of the pure rules in `grill-board/core/rules`
 * and registers `grillToolsFor(store, { prefix })`, or only the
 * `grillToolSpecs({ prefix })` when it wires its own handlers.
 */

import { exportAnswers, listPendingQuestions } from "./export.js";
import {
  addQuestions,
  answerQuestion,
  clearDrafts,
  saveDraft,
  setQuestionStatus,
  updateQuestion,
} from "./questions.js";
import { toDb, type Db, type SqliteDatabase } from "./sqlite.js";
import {
  createRound,
  createTopic,
  getTopic,
  listTopics,
  setTopicArchived,
  updateTopic,
} from "./topics.js";

/** Every domain operation, bound to one connection. All synchronous. */
export function createGrillCore(connection: SqliteDatabase) {
  const db = toDb(connection);
  const bind =
    <A extends unknown[], R>(operation: (db: Db, ...args: A) => R) =>
    (...args: A): R =>
      operation(db, ...args);

  return {
    listTopics: bind(listTopics),
    getTopic: bind(getTopic),
    createTopic: bind(createTopic),
    updateTopic: bind(updateTopic),
    setTopicArchived: bind(setTopicArchived),
    createRound: bind(createRound),
    addQuestions: bind(addQuestions),
    updateQuestion: bind(updateQuestion),
    setQuestionStatus: bind(setQuestionStatus),
    answerQuestion: bind(answerQuestion),
    saveDraft: bind(saveDraft),
    clearDrafts: bind(clearDrafts),
    listPendingQuestions: bind(listPendingQuestions),
    exportAnswers: bind(exportAnswers),
  };
}

export type GrillCore = ReturnType<typeof createGrillCore>;

export { LATEST_VERSION, migrate, schemaVersion } from "./migrations.js";
export {
  NotFoundError,
  questionIdTaken,
  questionNotFound,
  roundNotFound,
  toolName,
  topicIdTaken,
  topicNotFound,
} from "./errors.js";
export { computeProgress, type QuestionPatch } from "./rules.js";
export { answeredCount, groupByRound, isSettled, type RoundSectionData } from "./board.js";
export type { SqliteDatabase, SqliteStatement } from "./sqlite.js";
export type { NewRound } from "./topics.js";
export type * from "./types.js";
export {
  grillTools,
  grillToolSpecs,
  grillToolsFor,
  type Awaitable,
  type GrillAsyncTool,
  type GrillStore,
  type GrillTool,
  type GrillToolName,
  type GrillToolOptions,
  type GrillToolSpec,
} from "./mcp/tools.js";
export type { ToolResult } from "./mcp/result.js";
export * from "./mcp/schemas.js";
