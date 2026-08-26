/**
 * Data-access layer — public surface.
 *
 * The rest of the app (server functions, MCP tools, seed script) imports db
 * code ONLY from here. SQL lives behind this barrel and nowhere else.
 */

export { NotFoundError } from "./errors.js";

export {
  listTopics,
  getTopic,
  createTopic,
  updateTopic,
  setTopicArchived,
  createRound,
} from "./dal-topics.js";

export {
  addQuestions,
  updateQuestion,
  setQuestionStatus,
  answerQuestion,
  saveDraft,
  clearDrafts,
} from "./dal-questions.js";

export { listPendingQuestions, exportAnswers } from "./dal-export.js";

export { seedIfEmpty } from "./seed.js";
