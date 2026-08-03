/**
 * Zod input schemas for the MCP tools.
 *
 * Kept apart from the tool registrations so the shapes stay readable and the
 * shared enums are declared once. Zod 4 (`@modelcontextprotocol/server`
 * depends on `zod ^4.2.0`); every schema is a real `z.object(...)` because the
 * raw-shape overload of `registerTool` is deprecated in the shipped types.
 */

import * as z from 'zod';

export const topicStatusSchema = z
  .enum(['active', 'archived'])
  .describe("Topic status: 'active' (still being grilled) or 'archived'.");

export const questionStatusSchema = z
  .enum(['open', 'answered', 'suspended', 'pending_facts'])
  .describe(
    "Question status: 'open' (waiting on the human), 'answered' (an answer is recorded), " +
      "'suspended' (parked on purpose, does not count towards progress), " +
      "'pending_facts' (blocked until some fact is known, does not count towards progress).",
  );

export const answeredViaSchema = z
  .enum(['chat', 'board'])
  .describe(
    "Where the answer came from: 'chat' when the human told you in conversation, " +
      "'board' when they typed it in the web UI.",
  );

const topicId = z
  .string()
  .min(1)
  .describe("Topic id (a slug, e.g. 'ephemeral-preview-envs'). Call list_topics to find it.");

const questionId = z
  .string()
  .min(1)
  .describe("Question id, short and unique inside its topic (e.g. 'q7'). Call get_topic to find it.");

export const listTopicsInput = z.object({
  status: topicStatusSchema.optional().describe('Keep only topics in this status. Omit for all.'),
});

export const getTopicInput = z.object({ topicId });

export const createTopicInput = z.object({
  id: z
    .string()
    .min(1)
    .optional()
    .describe('Explicit topic id. Omit to derive a unique slug from the title.'),
  title: z.string().min(1).describe('Human-readable name of the thing being grilled.'),
  context: z
    .string()
    .optional()
    .describe('Short background paragraph shown at the top of the board.'),
  categories: z
    .array(z.string().min(1))
    .min(1)
    .describe(
      'Ordered category names. This order drives the section order on the board, and every ' +
        'question must name one of these categories.',
    ),
});

export const updateTopicInput = z.object({
  topicId,
  title: z.string().min(1).optional().describe('New title. Omit to leave it alone.'),
  context: z.string().optional().describe('New context text. Omit to leave it alone.'),
  categories: z
    .array(z.string().min(1))
    .min(1)
    .optional()
    .describe(
      'Replacement ordered category list. Add a category here before adding questions in it.',
    ),
});

export const archiveTopicInput = z.object({
  topicId,
  archived: z
    .boolean()
    .describe('true archives the topic, false brings it back to active. Both directions work.'),
});

export const createRoundInput = z.object({
  topicId,
  title: z.string().optional().describe('Optional label for the round, e.g. "Deployment gaps".'),
});

const newQuestionSchema = z.object({
  id: z
    .string()
    .min(1)
    .optional()
    .describe("Explicit short id. Omit to get the next free 'q<n>' of the topic."),
  category: z
    .string()
    .min(1)
    .describe("Must be one of the topic's declared categories (see get_topic.categories)."),
  text: z.string().min(1).describe('The question itself. One question, no compound asks.'),
  recommendation: z
    .string()
    .optional()
    .describe('Your own opinion on the answer. Shown as a separate panel on the card.'),
  recommendedOption: z
    .string()
    .min(1)
    .optional()
    .describe(
      'Which entry of `options` you recommend, verbatim. The board highlights that pill. ' +
        'Requires `options` and must match one of them exactly.',
    ),
  options: z
    .array(z.string().min(1))
    .optional()
    .describe('Quick-pick answers rendered as clickable pills. Survive being answered.'),
  note: z.string().optional().describe('Side note, normally the reason a question is parked.'),
  status: questionStatusSchema
    .optional()
    .describe("Starting status. Defaults to 'open' — that is what makes it appear as pending."),
});

export const addQuestionsInput = z.object({
  topicId,
  roundId: z
    .string()
    .min(1)
    .describe("Round id (e.g. 'my-topic#r2'). Call create_round or get_topic to get one."),
  questions: z.array(newQuestionSchema).min(1).describe('The batch to add, in display order.'),
});

export const updateQuestionInput = z.object({
  topicId,
  questionId,
  text: z.string().min(1).optional().describe('New question text.'),
  category: z
    .string()
    .min(1)
    .optional()
    .describe("New category; must be one of the topic's declared categories."),
  recommendation: z
    .string()
    .nullable()
    .optional()
    .describe('New recommendation. Pass null to remove it, omit to leave it alone.'),
  recommendedOption: z
    .string()
    .min(1)
    .nullable()
    .optional()
    .describe(
      'New recommended option; must match one of the (new or existing) options verbatim. ' +
        'Pass null to remove the highlight, omit to leave it alone. Replacing `options` with a ' +
        'list that no longer contains the marked option clears the marker.',
    ),
  options: z
    .array(z.string().min(1))
    .nullable()
    .optional()
    .describe('New quick-pick options. Pass null to remove them, omit to leave them alone.'),
  note: z
    .string()
    .nullable()
    .optional()
    .describe('New note. Pass null to remove it, omit to leave it alone.'),
});

export const setQuestionStatusInput = z.object({
  topicId,
  questionId,
  status: questionStatusSchema,
  note: z
    .string()
    .optional()
    .describe('Replaces the stored note. Omit to keep the note the question already has.'),
});

export const answerQuestionInput = z.object({
  topicId,
  questionId,
  answer: z.string().min(1).describe("The human's answer, verbatim. Do not paraphrase."),
  answeredVia: answeredViaSchema.default('chat'),
});

export const listPendingQuestionsInput = z.object({
  topicId: z
    .string()
    .min(1)
    .optional()
    .describe('Narrow to one topic. Omit to sweep every topic, archived ones included.'),
  includePendingFacts: z
    .boolean()
    .default(false)
    .describe("Also return questions in status 'pending_facts'. Off by default."),
});

export const exportAnswersInput = z.object({
  topicId,
  format: z
    .enum(['markdown', 'json'])
    .default('markdown')
    .describe("'markdown' for a ready-to-paste answer list, 'json' for a machine-readable one."),
});
