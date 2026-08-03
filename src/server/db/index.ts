/**
 * Data-access layer — public surface.
 *
 * The rest of the app (server functions, MCP tools, seed script) imports db
 * code ONLY from here. SQL lives behind this barrel and nowhere else.
 */

export { NotFoundError } from './errors';

export {
  listTopics,
  getTopic,
  createTopic,
  updateTopic,
  setTopicArchived,
  createRound,
} from './dal-topics';

export {
  addQuestions,
  updateQuestion,
  setQuestionStatus,
  answerQuestion,
  saveDraft,
  clearDrafts,
} from './dal-questions';

export { listPendingQuestions, exportAnswers } from './dal-export';

export { seedIfEmpty } from './seed';
