/**
 * The twelve Grill Board tools, as plain definitions.
 *
 * A tool is a name, a title, a description, a zod input schema (plus the same
 * schema as JSON Schema) and a handler. The core registers nothing: a host MCP
 * server registers each definition on its own endpoint. Every handler parses
 * its arguments, so it is safe to call with raw JSON-RPC params, and answers
 * with one text block. The descriptions are the only manual an agent gets, so
 * each one says what the tool does, what the arguments mean and which tool to
 * call when it fails.
 *
 * Three entry points share one table of definitions:
 *
 * - `grillToolSpecs({ prefix })`: name, title, description and schemas only,
 *   for a host that wires its own handlers (cross-references in descriptions
 *   name the prefixed tools);
 * - `grillToolsFor(store, { prefix })`: the specs plus async handlers over any
 *   `GrillStore` (Convex, Postgres, an in-memory map…);
 * - `grillTools(core)`: the unprefixed set with synchronous handlers over the
 *   SQLite core, exactly as before.
 */

import * as z from "zod";
import { topicNotFound } from "../errors.js";
import type { GrillCore } from "../index.js";
import type { NewRound } from "../topics.js";
import { assertDeclaredCategories, type QuestionPatch } from "../rules.js";
import type {
  AnsweredVia,
  NewQuestion,
  PendingQuestion,
  Question,
  QuestionStatus,
  Round,
  TopicDetail,
  TopicStatus,
  TopicSummary,
} from "../types.js";
import { grillInputSchemas } from "./schemas.js";
import { fail, failure, ok, type ToolResult } from "./result.js";

/** A value now, or later. */
export type Awaitable<T> = T | Promise<T>;

/**
 * The storage port the tools run on: the domain operations the twelve tools
 * need. An async store returns promises; the SQLite `GrillCore` satisfies it
 * synchronously. Implementations should reuse `grill-board/core/rules` so
 * every store behaves the same, and should build their not-found errors with
 * the same tool-name `prefix` the tools were created with (the builders in
 * `errors` take it), so recovery hints name tools the agent can call.
 */
export interface GrillStore {
  listTopics(status?: TopicStatus): Awaitable<TopicSummary[]>;
  /** `null` when there is no such topic. */
  getTopic(topicId: string): Awaitable<TopicDetail | null>;
  createTopic(input: {
    id?: string;
    title: string;
    context?: string;
    categories: string[];
  }): Awaitable<TopicDetail>;
  updateTopic(
    topicId: string,
    patch: { title?: string; context?: string; categories?: string[] },
  ): Awaitable<TopicDetail>;
  setTopicArchived(topicId: string, archived: boolean): Awaitable<TopicDetail>;
  createRound(topicId: string, extras?: NewRound): Awaitable<Round>;
  addQuestions(topicId: string, roundId: string, items: NewQuestion[]): Awaitable<Question[]>;
  updateQuestion(topicId: string, questionId: string, patch: QuestionPatch): Awaitable<Question>;
  setQuestionStatus(
    topicId: string,
    questionId: string,
    status: QuestionStatus,
    note?: string,
  ): Awaitable<Question>;
  answerQuestion(
    topicId: string,
    questionId: string,
    answer: string,
    answeredVia: AnsweredVia,
  ): Awaitable<Question>;
  listPendingQuestions(opts?: {
    topicId?: string;
    includePendingFacts?: boolean;
  }): Awaitable<PendingQuestion[]>;
  exportAnswers(topicId: string, format?: "markdown" | "json"): Awaitable<string>;
}

/** The base (unprefixed) name of each of the twelve tools. */
export type GrillToolName =
  | "list_topics"
  | "get_topic"
  | "create_topic"
  | "update_topic"
  | "archive_topic"
  | "create_round"
  | "add_questions"
  | "update_question"
  | "set_question_status"
  | "answer_question"
  | "list_pending_questions"
  | "export_answers";

export interface GrillToolOptions {
  /**
   * Prepended to every tool name, and to every tool named in descriptions and
   * error messages: `"grill_"` turns `create_round` into `grill_create_round`.
   * Defaults to `""`.
   */
  prefix?: string;
}

/** What a host needs to list a tool: everything but the handler. */
export interface GrillToolSpec {
  /** The registered name, prefix included. */
  name: string;
  /** The name without the prefix. */
  baseName: GrillToolName;
  title: string;
  description: string;
  inputSchema: z.ZodObject;
  /** `inputSchema` as JSON Schema, for hosts that do not speak zod. */
  inputJsonSchema: Record<string, unknown>;
}

/** One MCP tool, ready for a host server to register. */
export interface GrillTool {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodObject;
  /** `inputSchema` as JSON Schema, for hosts that do not speak zod. */
  inputJsonSchema: Record<string, unknown>;
  /** Parses `args` with `inputSchema`, runs the tool, never throws. */
  handler: (args: unknown) => ToolResult;
}

/** One MCP tool over an async store. */
export interface GrillAsyncTool extends GrillToolSpec {
  /** Parses `args` with `inputSchema`, runs the tool, never rejects. */
  handler: (args: unknown) => Promise<ToolResult>;
}

/** What a run produces: a value to send as compact JSON, or text as is. */
type Output =
  | { kind: "json"; produce: () => Awaitable<unknown> }
  | { kind: "text"; produce: () => Awaitable<string> };

interface Definition extends GrillToolSpec {
  run: (store: GrillStore, args: unknown) => Output;
}

const json = (produce: () => Awaitable<unknown>): Output => ({ kind: "json", produce });
const text = (produce: () => Awaitable<string>): Output => ({ kind: "text", produce });

function isPromise<T>(value: Awaitable<T>): value is Promise<T> {
  return typeof (value as Promise<T> | undefined)?.then === "function";
}

/** Chains on a value that may or may not be a promise, staying sync when it is not. */
function then<A, B>(value: Awaitable<A>, next: (value: A) => Awaitable<B>): Awaitable<B> {
  return isPromise(value) ? value.then(next) : next(value);
}

/** Reads a topic or throws the same not-found message the data layer uses. */
function requireTopic(store: GrillStore, topicId: string, prefix: string): Awaitable<TopicDetail> {
  return then(store.getTopic(topicId), (topic) => {
    if (topic === null) throw topicNotFound(topicId, prefix);
    return topic;
  });
}

function render(kind: Output["kind"], value: unknown): ToolResult {
  return ok(kind === "json" ? JSON.stringify(value) : (value as string));
}

/** The tool table for one prefix, in the order `tools/list` shows it. */
function definitions(prefix: string): Definition[] {
  const n = (name: GrillToolName) => `${prefix}${name}`;
  const s = grillInputSchemas(prefix);

  function define<S extends z.ZodObject>(
    baseName: GrillToolName,
    config: { title: string; description: string; inputSchema: S },
    run: (store: GrillStore, args: z.output<S>) => Output,
  ): Definition {
    return {
      name: n(baseName),
      baseName,
      ...config,
      inputJsonSchema: z.toJSONSchema(config.inputSchema, { io: "input" }),
      run: (store, args) => run(store, args as z.output<S>),
    };
  }

  return [
    define(
      "list_topics",
      {
        title: "List topics",
        description:
          "Every grill topic, most recently touched first, each with its status, its context and " +
          "its progress counters ({done, total, percent}). `total` counts the questions that are " +
          "'open' or 'answered'; `done` counts those that are answered or already carry a draft " +
          "answer. Pass status to see only 'active' or only 'archived' topics. Start here when " +
          "you do not know a topic id.",
        inputSchema: s.listTopicsInput,
      },
      (store, { status }) => json(() => store.listTopics(status)),
    ),

    define(
      "get_topic",
      {
        title: "Get topic",
        description:
          "The full state of one topic: title, context, ordered categories, every round, every " +
          "question with all of its fields (status, text, recommendation, options, note, answer, " +
          "answeredVia, draft, roundNumber, position) and the computed progress. This is the tool " +
          "to call before editing anything, and after a human says they answered on the board. " +
          "Absent fields are omitted rather than sent as null.",
        inputSchema: s.getTopicInput,
      },
      (store, { topicId }) => json(() => requireTopic(store, topicId, prefix)),
    ),

    define(
      "create_topic",
      {
        title: "Create topic",
        description:
          "Start a new grill. Give it a title, an optional context paragraph and the ordered list " +
          "of categories the questions will be grouped into — that order is the order of the " +
          "sections on the board. The topic id is derived from the title unless you pass one; the " +
          "returned object carries the id you must use in every later call. Creating a topic does " +
          `not create a round: call ${n("create_round")} next, then ${n("add_questions")}.`,
        inputSchema: s.createTopicInput,
      },
      (store, { id, title, context, categories }) =>
        json(() => store.createTopic({ id, title, context, categories })),
    ),

    define(
      "update_topic",
      {
        title: "Update topic",
        description:
          "Edit a topic in place. Only the arguments you send are written; the ones you omit are " +
          "left as they are. Sending categories REPLACES the whole ordered list, so include the " +
          `existing names you want to keep — read them from ${n("get_topic")} first. Returns the updated topic.`,
        inputSchema: s.updateTopicInput,
      },
      (store, { topicId, title, context, categories }) =>
        json(() => store.updateTopic(topicId, { title, context, categories })),
    ),

    define(
      "archive_topic",
      {
        title: "Archive or un-archive topic",
        description:
          "Move a topic out of the active list (archived: true) or bring it back (archived: false). " +
          "Archiving hides nothing and deletes nothing — every question, answer and round survives " +
          `and the topic still shows up in ${n("list_topics")} with status "archived". Returns the topic.`,
        inputSchema: s.archiveTopicInput,
      },
      (store, { topicId, archived }) => json(() => store.setTopicArchived(topicId, archived)),
    ),

    define(
      "create_round",
      {
        title: "Create round",
        description:
          "Open the next round of questions on a topic. The number is assigned for you — one more " +
          "than the highest existing round, starting at 1. Returns {id, topicId, number, title?, " +
          `kind, synthesis?, createdAt}; feed that id straight into ${n("add_questions")}. Use a new round ` +
          "for each new wave of questions you fire after reading the answers to the previous one. " +
          "When the frontier is empty, close with kind: 'confirmation' + synthesis (markdown) and " +
          "one gate question whose options carry the proposed next step.",
        inputSchema: s.createRoundInput,
      },
      (store, { topicId, title, kind, synthesis }) =>
        json(() => store.createRound(topicId, { title, kind, synthesis })),
    ),

    define(
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
        inputSchema: s.addQuestionsInput,
      },
      (store, { topicId, roundId, questions }) =>
        json(() =>
          then(requireTopic(store, topicId, prefix), (topic) => {
            assertDeclaredCategories(
              topic,
              questions.map((question) => question.category),
              prefix,
            );
            return store.addQuestions(topicId, roundId, questions);
          }),
        ),
    ),

    define(
      "update_question",
      {
        title: "Update question",
        description:
          "Edit the content of one question: text, category, recommendation, recommendedOption, " +
          "options or note. Omitted arguments are left untouched; sending null for recommendation, " +
          "recommendedOption, options or note clears that field. This tool never changes the " +
          `status and never touches the answer — use ${n("set_question_status")} or ${n("answer_question")} for ` +
          "those. Returns the updated question.",
        inputSchema: s.updateQuestionInput,
      },
      (
        store,
        { topicId, questionId, text, category, recommendation, recommendedOption, options, note },
      ) =>
        json(() => {
          const update = () =>
            store.updateQuestion(topicId, questionId, {
              text,
              category,
              recommendation,
              recommendedOption,
              options,
              note,
            });
          if (category === undefined) return update();
          return then(requireTopic(store, topicId, prefix), (topic) => {
            assertDeclaredCategories(topic, [category], prefix);
            return update();
          });
        }),
    ),

    define(
      "set_question_status",
      {
        title: "Set question status",
        description:
          "Move one question to another status: 'open' (waiting on the human — this is what makes " +
          `it show up in ${n("list_pending_questions")}), 'answered' (prefer ${n("answer_question")}, which also ` +
          "records the answer), 'suspended' (parked on purpose) or 'pending_facts' (blocked until " +
          "some fact is known). Suspended and pending_facts questions drop out of the progress " +
          "counters. A note sent here REPLACES the stored note; omit it to keep the note as it is — " +
          "always leave a note when you park a question. Returns the updated question.",
        inputSchema: s.setQuestionStatusInput,
      },
      (store, { topicId, questionId, status, note }) =>
        json(() => store.setQuestionStatus(topicId, questionId, status, note)),
    ),

    define(
      "answer_question",
      {
        title: "Answer question",
        description:
          "Record the human's answer and flip the question to 'answered' in one step. Store the " +
          'answer verbatim — do not summarise it. Set answeredVia to "chat" when the human ' +
          'answered you in conversation, or "board" when they typed it in the web UI. Any ' +
          "auto-saved draft on the question is dropped; the quick-pick options are kept. Returns " +
          "the updated question.",
        inputSchema: s.answerQuestionInput,
      },
      (store, { topicId, questionId, answer, answeredVia }) =>
        json(() => store.answerQuestion(topicId, questionId, answer, answeredVia)),
    ),

    define(
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
        inputSchema: s.listPendingQuestionsInput,
      },
      (store, { topicId, includePendingFacts }) =>
        json(() => store.listPendingQuestions({ topicId, includePendingFacts })),
    ),

    define(
      "export_answers",
      {
        title: "Export answers",
        description:
          "Every recorded answer of a topic, in round then board order. Drafts are not answers and " +
          'are never exported. Format "markdown" (the default) returns a ready-to-paste list under ' +
          'a "## Answers — <title>" heading; format "json" returns {topicId, title, answers:[{id, ' +
          "round, category, answer, answeredVia?}]}. The payload is plain text, not a wrapped " +
          "object — read it as it comes.",
        inputSchema: s.exportAnswersInput,
      },
      (store, { topicId, format }) => text(() => store.exportAnswers(topicId, format)),
    ),
  ];
}

function parse(
  definition: Definition,
  args: unknown,
): { ok: true; data: unknown } | { ok: false; result: ToolResult } {
  const parsed = definition.inputSchema.safeParse(args ?? {});
  if (!parsed.success) return { ok: false, result: fail(z.prettifyError(parsed.error)) };
  return { ok: true, data: parsed.data };
}

function toSpec({
  name,
  baseName,
  title,
  description,
  inputSchema,
  inputJsonSchema,
}: Definition): GrillToolSpec {
  return { name, baseName, title, description, inputSchema, inputJsonSchema };
}

/**
 * The twelve tool specs — name, title, description, zod and JSON Schema —
 * with every cross-reference in descriptions named under `prefix`. For a host
 * that wires its own handlers (an Effect `McpServer`, a Convex action…).
 */
export function grillToolSpecs(options: GrillToolOptions = {}): GrillToolSpec[] {
  return definitions(options.prefix ?? "").map(toSpec);
}

/**
 * The twelve tools over any `GrillStore`, with async handlers. Names,
 * descriptions and the error messages produced here carry `prefix`.
 */
export function grillToolsFor(store: GrillStore, options: GrillToolOptions = {}): GrillAsyncTool[] {
  const prefix = options.prefix ?? "";
  return definitions(prefix).map((definition) => ({
    ...toSpec(definition),
    handler: async (args) => {
      const parsed = parse(definition, args);
      if (!parsed.ok) return parsed.result;
      try {
        const output = definition.run(store, parsed.data);
        return render(output.kind, await output.produce());
      } catch (error) {
        return failure(error, prefix);
      }
    },
  }));
}

/** The tool set of one SQLite core, unprefixed, with synchronous handlers. */
export function grillTools(core: GrillCore): GrillTool[] {
  return definitions("").map((definition) => {
    const { name, title, description, inputSchema, inputJsonSchema } = definition;
    return {
      name,
      title,
      description,
      inputSchema,
      inputJsonSchema,
      handler: (args) => {
        const parsed = parse(definition, args);
        if (!parsed.ok) return parsed.result;
        try {
          const output = definition.run(core, parsed.data);
          const value = output.produce();
          if (isPromise(value)) {
            value.catch(() => {});
            throw new Error("grillTools needs a synchronous core; use grillToolsFor for a store");
          }
          return render(output.kind, value);
        } catch (error) {
          return failure(error);
        }
      },
    };
  });
}
