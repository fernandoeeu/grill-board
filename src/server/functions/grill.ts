/**
 * Server functions — the browser's door to the data-access layer.
 *
 * One function per DAL call, nothing more: validate the input with zod, call
 * the DAL, hand the result back. All business rules (progress, slugs, draft
 * clearing, ordering) live in `@/server/db` and are never repeated here.
 *
 * Reads are `GET`, mutations are `POST`. Every call takes a single flat object
 * so the UI never has to remember positional arguments.
 */

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import type {
  Question,
  Round,
  TopicDetail,
  TopicSummary,
} from '@/lib/types';
import {
  NotFoundError,
  addQuestions,
  answerQuestion,
  clearDrafts,
  createRound,
  createTopic,
  exportAnswers,
  getTopic,
  listTopics,
  saveDraft,
  setQuestionStatus,
  setTopicArchived,
  updateQuestion,
  updateTopic,
} from '@/server/db';

/**
 * The DAL throws `NotFoundError` for an unknown id. Re-throw it as a plain
 * `Error` so only the (agent- and human-readable) message crosses the RPC
 * boundary — never a class instance or a stack trace.
 */
function guard<T>(call: () => T): T {
  try {
    return call();
  } catch (error) {
    if (error instanceof NotFoundError) throw new Error(error.message);
    throw error;
  }
}

const topicId = z.string().min(1);
const questionId = z.string().min(1);
const questionStatus = z.enum(['open', 'answered', 'suspended', 'pending_facts']);
const answeredVia = z.enum(['chat', 'board']);
const draft = z.object({
  option: z.string().optional(),
  text: z.string().optional(),
});
const newQuestion = z.object({
  id: z.string().min(1).optional(),
  category: z.string().min(1),
  text: z.string().min(1),
  recommendation: z.string().optional(),
  recommendedOption: z.string().min(1).optional(),
  options: z.array(z.string()).optional(),
  note: z.string().optional(),
  status: questionStatus.optional(),
});

/** Every topic, active and archived, with its progress. */
export const listTopicsFn = createServerFn({ method: 'GET' }).handler(
  (): TopicSummary[] => listTopics(),
);

/** Full state of one topic. `null` — never an error — when the id is unknown. */
export const getTopicFn = createServerFn({ method: 'GET' })
  .validator(z.object({ topicId }))
  .handler(({ data }): TopicDetail | null => getTopic(data.topicId));

export const createTopicFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: z.string().min(1).optional(),
      title: z.string().min(1),
      context: z.string().optional(),
      categories: z.array(z.string().min(1)),
    }),
  )
  .handler(({ data }): TopicDetail => createTopic(data));

export const updateTopicFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      topicId,
      title: z.string().min(1).optional(),
      context: z.string().optional(),
      categories: z.array(z.string().min(1)).optional(),
    }),
  )
  .handler(({ data }): TopicDetail => {
    const { topicId: id, ...patch } = data;
    return guard(() => updateTopic(id, patch));
  });

export const setTopicArchivedFn = createServerFn({ method: 'POST' })
  .validator(z.object({ topicId, archived: z.boolean() }))
  .handler(({ data }): TopicDetail =>
    guard(() => setTopicArchived(data.topicId, data.archived)),
  );

/** Opens the next round; its number is assigned by the DAL. */
export const createRoundFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      topicId,
      title: z.string().min(1).optional(),
      kind: z.enum(['grill', 'confirmation']).optional(),
      synthesis: z.string().min(1).optional(),
    }),
  )
  .handler(({ data }): Round => {
    const { topicId: id, ...extras } = data;
    return guard(() => createRound(id, extras));
  });

export const addQuestionsFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      topicId,
      roundId: z.string().min(1),
      items: z.array(newQuestion),
    }),
  )
  .handler(({ data }): Question[] =>
    guard(() => addQuestions(data.topicId, data.roundId, data.items)),
  );

/** Absent keys are left untouched; an explicit `null` clears the column. */
export const updateQuestionFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      topicId,
      questionId,
      text: z.string().min(1).optional(),
      category: z.string().min(1).optional(),
      recommendation: z.string().nullable().optional(),
      recommendedOption: z.string().min(1).nullable().optional(),
      options: z.array(z.string()).nullable().optional(),
      note: z.string().nullable().optional(),
    }),
  )
  .handler(({ data }): Question => {
    const { topicId: id, questionId: qid, ...patch } = data;
    return guard(() => updateQuestion(id, qid, patch));
  });

/** A `note` given here replaces the stored one; omitting it keeps it. */
export const setQuestionStatusFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({ topicId, questionId, status: questionStatus, note: z.string().optional() }),
  )
  .handler(({ data }): Question =>
    guard(() => setQuestionStatus(data.topicId, data.questionId, data.status, data.note)),
  );

/** Records an answer and flips the question to `answered`. */
export const answerQuestionFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({ topicId, questionId, answer: z.string().min(1), answeredVia }),
  )
  .handler(({ data }): Question =>
    guard(() => answerQuestion(data.topicId, data.questionId, data.answer, data.answeredVia)),
  );

/** Auto-save of an unsubmitted answer; `null` clears the draft. */
export const saveDraftFn = createServerFn({ method: 'POST' })
  .validator(z.object({ topicId, questionId, draft: draft.nullable() }))
  .handler(({ data }): Question =>
    guard(() => saveDraft(data.topicId, data.questionId, data.draft)),
  );

/** Clears every draft of a topic. Returns how many were cleared. */
export const clearDraftsFn = createServerFn({ method: 'POST' })
  .validator(z.object({ topicId }))
  .handler(({ data }): number => guard(() => clearDrafts(data.topicId)));

/** Recorded answers of a topic, as Markdown (default) or JSON. */
export const exportAnswersFn = createServerFn({ method: 'GET' })
  .validator(z.object({ topicId, format: z.enum(['markdown', 'json']).optional() }))
  .handler(({ data }): string => guard(() => exportAnswers(data.topicId, data.format)));
