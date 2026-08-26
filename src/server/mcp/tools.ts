/**
 * The twelve Grill Board tools.
 *
 * Every tool goes through the shared data-access layer (`@/server/db`) — there
 * is no SQL and no filesystem access here. The descriptions are the only
 * manual an agent gets, so each one says what the tool does, what the
 * arguments mean and which tool to call when it fails.
 */

import type { McpServer } from "@modelcontextprotocol/server";
import type { TopicDetail } from "@/lib/types";
import {
  NotFoundError,
  addQuestions,
  answerQuestion,
  createRound,
  createTopic,
  exportAnswers,
  getTopic,
  listPendingQuestions,
  listTopics,
  setQuestionStatus,
  setTopicArchived,
  updateQuestion,
  updateTopic,
} from "@/server/db";
import {
  addQuestionsInput,
  answerQuestionInput,
  archiveTopicInput,
  createRoundInput,
  createTopicInput,
  exportAnswersInput,
  getTopicInput,
  listPendingQuestionsInput,
  listTopicsInput,
  setQuestionStatusInput,
  updateQuestionInput,
  updateTopicInput,
} from "./schemas";
import { jsonResult, textResult } from "./result";

/** Reads a topic or throws the same not-found message the db layer uses. */
function requireTopic(topicId: string): TopicDetail {
  const topic = getTopic(topicId);
  if (topic === null) {
    throw new NotFoundError(`no topic with id '${topicId}'; call list_topics`);
  }
  return topic;
}

/**
 * The board groups questions by the topic's declared categories, so a question
 * in an undeclared category would never be shown. The db layer stays permissive;
 * the agent-facing layer refuses early and says how to fix it.
 */
function requireDeclaredCategories(topic: TopicDetail, categories: string[]): void {
  const undeclared = [...new Set(categories)].filter((name) => !topic.categories.includes(name));
  if (undeclared.length === 0) return;
  throw new Error(
    `topic '${topic.id}' does not declare the category ${undeclared
      .map((name) => `'${name}'`)
      .join(", ")}; it declares ${topic.categories.map((name) => `'${name}'`).join(", ")}. ` +
      "Use one of those, or call update_topic with the full new category list first.",
  );
}

export function registerGrillTools(server: McpServer): void {
  server.registerTool(
    "list_topics",
    {
      title: "List topics",
      description:
        "Every grill topic, most recently touched first, each with its status, its context and " +
        "its progress counters ({done, total, percent}). `total` counts the questions that are " +
        "'open' or 'answered'; `done` counts those that are answered or already carry a draft " +
        "answer. Pass status to see only 'active' or only 'archived' topics. Start here when " +
        "you do not know a topic id.",
      inputSchema: listTopicsInput,
    },
    ({ status }) => jsonResult(() => listTopics(status)),
  );

  server.registerTool(
    "get_topic",
    {
      title: "Get topic",
      description:
        "The full state of one topic: title, context, ordered categories, every round, every " +
        "question with all of its fields (status, text, recommendation, options, note, answer, " +
        "answeredVia, draft, roundNumber, position) and the computed progress. This is the tool " +
        "to call before editing anything, and after a human says they answered on the board. " +
        "Absent fields are omitted rather than sent as null.",
      inputSchema: getTopicInput,
    },
    ({ topicId }) => jsonResult(() => requireTopic(topicId)),
  );

  server.registerTool(
    "create_topic",
    {
      title: "Create topic",
      description:
        "Start a new grill. Give it a title, an optional context paragraph and the ordered list " +
        "of categories the questions will be grouped into — that order is the order of the " +
        "sections on the board. The topic id is derived from the title unless you pass one; the " +
        "returned object carries the id you must use in every later call. Creating a topic does " +
        "not create a round: call create_round next, then add_questions.",
      inputSchema: createTopicInput,
    },
    ({ id, title, context, categories }) =>
      jsonResult(() => createTopic({ id, title, context, categories })),
  );

  server.registerTool(
    "update_topic",
    {
      title: "Update topic",
      description:
        "Edit a topic in place. Only the arguments you send are written; the ones you omit are " +
        "left as they are. Sending categories REPLACES the whole ordered list, so include the " +
        "existing names you want to keep — read them from get_topic first. Returns the updated topic.",
      inputSchema: updateTopicInput,
    },
    ({ topicId, title, context, categories }) =>
      jsonResult(() => updateTopic(topicId, { title, context, categories })),
  );

  server.registerTool(
    "archive_topic",
    {
      title: "Archive or un-archive topic",
      description:
        "Move a topic out of the active list (archived: true) or bring it back (archived: false). " +
        "Archiving hides nothing and deletes nothing — every question, answer and round survives " +
        'and the topic still shows up in list_topics with status "archived". Returns the topic.',
      inputSchema: archiveTopicInput,
    },
    ({ topicId, archived }) => jsonResult(() => setTopicArchived(topicId, archived)),
  );

  server.registerTool(
    "create_round",
    {
      title: "Create round",
      description:
        "Open the next round of questions on a topic. The number is assigned for you — one more " +
        "than the highest existing round, starting at 1. Returns {id, topicId, number, title?, " +
        "kind, synthesis?, createdAt}; feed that id straight into add_questions. Use a new round " +
        "for each new wave of questions you fire after reading the answers to the previous one. " +
        "When the frontier is empty, close with kind: 'confirmation' + synthesis (markdown) and " +
        "one gate question whose options carry the proposed next step.",
      inputSchema: createRoundInput,
    },
    ({ topicId, title, kind, synthesis }) =>
      jsonResult(() => createRound(topicId, { title, kind, synthesis })),
  );

  server.registerTool(
    "add_questions",
    {
      title: "Add questions",
      description:
        "Add a batch of questions to one round, in one go — always prefer one batched call over " +
        "many single ones. Each question needs a category (one of the topic's declared " +
        "categories) and text. Optional per question: recommendation (your own opinion, shown as " +
        "its own panel), options (quick-pick answers rendered as clickable pills), " +
        "recommendedOption (the options entry you recommend — the board highlights that pill), " +
        "note, an " +
        "explicit id, and status ('open' | 'answered' | 'suspended' | 'pending_facts'; defaults " +
        "to 'open'). The batch keeps its order on the board. Returns the created questions with " +
        "their assigned ids and positions.",
      inputSchema: addQuestionsInput,
    },
    ({ topicId, roundId, questions }) =>
      jsonResult(() => {
        const topic = requireTopic(topicId);
        requireDeclaredCategories(
          topic,
          questions.map((question) => question.category),
        );
        return addQuestions(topicId, roundId, questions);
      }),
  );

  server.registerTool(
    "update_question",
    {
      title: "Update question",
      description:
        "Edit the content of one question: text, category, recommendation, recommendedOption, " +
        "options or note. Omitted arguments are left untouched; sending null for recommendation, " +
        "recommendedOption, options or note clears that field. This tool never changes the " +
        "status and never touches the answer — use set_question_status or answer_question for " +
        "those. Returns the updated question.",
      inputSchema: updateQuestionInput,
    },
    ({ topicId, questionId, text, category, recommendation, recommendedOption, options, note }) =>
      jsonResult(() => {
        if (category !== undefined) {
          requireDeclaredCategories(requireTopic(topicId), [category]);
        }
        return updateQuestion(topicId, questionId, {
          text,
          category,
          recommendation,
          recommendedOption,
          options,
          note,
        });
      }),
  );

  server.registerTool(
    "set_question_status",
    {
      title: "Set question status",
      description:
        "Move one question to another status: 'open' (waiting on the human — this is what makes " +
        "it show up in list_pending_questions), 'answered' (prefer answer_question, which also " +
        "records the answer), 'suspended' (parked on purpose) or 'pending_facts' (blocked until " +
        "some fact is known). Suspended and pending_facts questions drop out of the progress " +
        "counters. A note sent here REPLACES the stored note; omit it to keep the note as it is — " +
        "always leave a note when you park a question. Returns the updated question.",
      inputSchema: setQuestionStatusInput,
    },
    ({ topicId, questionId, status, note }) =>
      jsonResult(() => setQuestionStatus(topicId, questionId, status, note)),
  );

  server.registerTool(
    "answer_question",
    {
      title: "Answer question",
      description:
        "Record the human's answer and flip the question to 'answered' in one step. Store the " +
        'answer verbatim — do not summarise it. Set answeredVia to "chat" when the human ' +
        'answered you in conversation, or "board" when they typed it in the web UI. Any ' +
        "auto-saved draft on the question is dropped; the quick-pick options are kept. Returns " +
        "the updated question.",
      inputSchema: answerQuestionInput,
    },
    ({ topicId, questionId, answer, answeredVia }) =>
      jsonResult(() => answerQuestion(topicId, questionId, answer, answeredVia)),
  );

  server.registerTool(
    "list_pending_questions",
    {
      title: "List pending questions",
      description:
        "Everything still waiting on the human. Returns 'open' questions by default, each with " +
        "its topicId, topicTitle and the whole question object — including any draft the human " +
        "has typed but not submitted, which is worth reading before you nudge them. Pass " +
        "topicId to narrow to one grill; omit it to sweep every topic, archived ones included. " +
        "Pass includePendingFacts: true to also see the questions blocked on missing facts. " +
        "An empty array means the human is done and you can fire the next round.",
      inputSchema: listPendingQuestionsInput,
    },
    ({ topicId, includePendingFacts }) =>
      jsonResult(() => listPendingQuestions({ topicId, includePendingFacts })),
  );

  server.registerTool(
    "export_answers",
    {
      title: "Export answers",
      description:
        "Every recorded answer of a topic, in round then board order. Drafts are not answers and " +
        'are never exported. Format "markdown" (the default) returns a ready-to-paste list under ' +
        'a "## Answers — <title>" heading; format "json" returns {topicId, title, answers:[{id, ' +
        "round, category, answer, answeredVia?}]}. The payload is plain text, not a wrapped " +
        "object — read it as it comes.",
      inputSchema: exportAnswersInput,
    },
    ({ topicId, format }) => textResult(() => exportAnswers(topicId, format)),
  );
}
