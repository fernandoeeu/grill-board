/**
 * First-boot seed: imports the prototype topic (spec §5) into SQLite.
 *
 * It writes EXCLUSIVELY through the data-access layer — no SQL here — so the
 * seeded rows go through exactly the same code path as an agent creating a
 * topic over MCP. Idempotent: it returns early when the topic already exists.
 */
import type { NewQuestion, QuestionStatus } from "@/lib/types";
import { createRound, createTopic, getTopic } from "./dal-topics.js";
import { addQuestions, answerQuestion } from "./dal-questions.js";
import { seedTopic, type SeedQuestion } from "./seed-data.js";

/**
 * Status a question is CREATED with.
 *
 * Answered questions start `open` and are flipped by `answerQuestion`, which is
 * the only function that records an answer and its provenance. Every other
 * status (`suspended`, `pending_facts`) is final and is set at creation time,
 * together with its note.
 */
function initialStatus(question: SeedQuestion): QuestionStatus {
  return question.status === "answered" ? "open" : question.status;
}

/** Seed question → DAL input, omitting absent optional fields entirely. */
function toNewQuestion(question: SeedQuestion): NewQuestion {
  const item: NewQuestion = {
    id: question.id,
    category: question.category,
    text: question.text,
    status: initialStatus(question),
  };
  if (question.recommendation !== undefined) {
    item.recommendation = question.recommendation;
  }
  if (question.options !== undefined) item.options = question.options;
  if (question.note !== undefined) item.note = question.note;
  return item;
}

/**
 * Create the seed topic if it is not in the database yet.
 *
 * Called on server startup and by `pnpm seed`.
 */
export function seedIfEmpty(): void {
  if (getTopic(seedTopic.id) !== null) return;

  createTopic({
    id: seedTopic.id,
    title: seedTopic.title,
    context: seedTopic.context,
    categories: seedTopic.categories,
  });

  // Rounds are numbered by the DAL in creation order; keep the map from the
  // seed's round number to the generated round id.
  const roundIds = new Map<number, string>();
  for (const round of seedTopic.rounds) {
    const created = createRound(seedTopic.id);
    if (created.number !== round.number) {
      throw new Error(
        `seed: expected round ${round.number}, the database created round ${created.number}`,
      );
    }
    roundIds.set(created.number, created.id);
  }

  const orphan = seedTopic.questions.find((question) => !roundIds.has(question.round));
  if (orphan) {
    throw new Error(
      `seed: question '${orphan.id}' belongs to round ${orphan.round}, which the seed does not declare`,
    );
  }

  // One batch per round, questions in the order the seed declares them.
  for (const [number, roundId] of roundIds) {
    const items = seedTopic.questions
      .filter((question) => question.round === number)
      .map(toNewQuestion);
    if (items.length > 0) addQuestions(seedTopic.id, roundId, items);
  }

  // Record the answers written in chat. This sets the answer, its provenance
  // and status `answered`; text, recommendation, options and note stay as
  // created, so an answered question keeps its quick options (q6).
  for (const question of seedTopic.questions) {
    if (question.answer === undefined) continue;
    answerQuestion(seedTopic.id, question.id, question.answer, question.answeredVia ?? "chat");
  }
}
