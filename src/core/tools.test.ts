import assert from "node:assert/strict";
import { test } from "node:test";
import Database from "better-sqlite3";
import {
  createGrillCore,
  grillTools,
  grillToolSpecs,
  grillToolsFor,
  migrate,
  type GrillStore,
} from "./index.js";

const BASE_NAMES = [
  "list_topics",
  "get_topic",
  "create_topic",
  "update_topic",
  "archive_topic",
  "create_round",
  "add_questions",
  "update_question",
  "set_question_status",
  "answer_question",
  "list_pending_questions",
  "export_answers",
];

/** An async store, as a Convex or Postgres host would expose it. */
function asyncStore(): GrillStore {
  const db = new Database(":memory:");
  migrate(db);
  const core = createGrillCore(db);
  return Object.fromEntries(
    Object.entries(core).map(([key, operation]) => [
      key,
      async (...args: unknown[]) => (operation as (...a: unknown[]) => unknown)(...args),
    ]),
  ) as unknown as GrillStore;
}

function textOf(result: { content: Array<{ text: string }> }): string {
  return result.content[0]!.text;
}

test("default specs match grillTools, unprefixed", () => {
  const db = new Database(":memory:");
  migrate(db);
  const tools = grillTools(createGrillCore(db));
  const specs = grillToolSpecs();
  assert.deepEqual(
    specs.map((spec) => spec.name),
    BASE_NAMES,
  );
  for (const [index, spec] of specs.entries()) {
    const tool = tools[index]!;
    assert.equal(tool.name, spec.name);
    assert.equal(tool.description, spec.description);
    assert.deepEqual(tool.inputJsonSchema, spec.inputJsonSchema);
  }
});

test("a prefix renames every tool and every cross-reference", () => {
  const specs = grillToolSpecs({ prefix: "grill_" });
  assert.deepEqual(
    specs.map((spec) => spec.name),
    BASE_NAMES.map((name) => `grill_${name}`),
  );
  assert.deepEqual(
    specs.map((spec) => spec.baseName),
    BASE_NAMES,
  );

  const unprefixed = new RegExp(`(?<!grill_)\\b(${BASE_NAMES.join("|")})\\b`);
  for (const spec of specs) {
    const text = spec.description + JSON.stringify(spec.inputJsonSchema);
    assert.doesNotMatch(text, unprefixed, spec.name);
  }
  const createTopic = specs.find((spec) => spec.baseName === "create_topic")!;
  assert.match(createTopic.description, /call grill_create_round next, then grill_add_questions/);
});

test("grillToolsFor runs a whole grill on an async store", async () => {
  const tools = new Map(
    grillToolsFor(asyncStore(), { prefix: "grill_" }).map((tool) => [tool.name, tool]),
  );
  const call = async (name: string, args: unknown) => {
    const result = await tools.get(`grill_${name}`)!.handler(args);
    assert.equal(result.isError, undefined, textOf(result));
    return textOf(result);
  };

  const topic = JSON.parse(
    await call("create_topic", { title: "Port to Convex", categories: ["scope"] }),
  );
  const round = JSON.parse(await call("create_round", { topicId: topic.id }));
  await call("add_questions", {
    topicId: topic.id,
    roundId: round.id,
    questions: [{ category: "scope", text: "Async store?", options: ["yes", "no"] }],
  });
  await call("answer_question", { topicId: topic.id, questionId: "q1", answer: "yes" });
  assert.equal(
    await call("export_answers", { topicId: topic.id }),
    "## Answers — Port to Convex\n\n- **q1** (round 1): yes",
  );

  const missing = await tools.get("grill_get_topic")!.handler({ topicId: "nope" });
  assert.equal(missing.isError, true);
  assert.equal(textOf(missing), "no topic with id 'nope'; call grill_list_topics");

  const undeclared = await tools.get("grill_add_questions")!.handler({
    topicId: topic.id,
    roundId: round.id,
    questions: [{ category: "cost", text: "?" }],
  });
  assert.equal(undeclared.isError, true);
  assert.match(textOf(undeclared), /call grill_update_topic with the full new category list/);

  const invalid = await tools.get("grill_create_topic")!.handler({ title: "" });
  assert.equal(invalid.isError, true);
});

test("grillTools keeps the historical unprefixed error messages", () => {
  const db = new Database(":memory:");
  migrate(db);
  const tools = new Map(grillTools(createGrillCore(db)).map((tool) => [tool.name, tool]));
  const missing = tools.get("get_topic")!.handler({ topicId: "nope" });
  assert.equal(missing.isError, true);
  assert.equal(textOf(missing), "no topic with id 'nope'; call list_topics");
});

test("the SQLite core applies the shared rules", () => {
  const db = new Database(":memory:");
  migrate(db);
  const core = createGrillCore(db);
  const topic = core.createTopic({ title: "Rules", categories: ["scope"] });
  assert.equal(core.createTopic({ title: "Rules", categories: ["scope"] }).id, "rules-2");
  const round = core.createRound(topic.id);
  assert.equal(core.createRound(topic.id).number, 2);
  const [q1, q2] = core.addQuestions(topic.id, round.id, [
    { category: "scope", text: "A", options: ["a", "b"], recommendedOption: "a", note: " " },
    { category: "scope", text: "B" },
  ]);
  assert.equal(q1!.id, "q1");
  assert.equal("note" in q1!, false);
  assert.equal(q2!.position, 1);

  assert.equal(
    "recommendedOption" in core.updateQuestion(topic.id, "q1", { options: ["b"] }),
    false,
  );
  assert.equal(
    core.updateQuestion(topic.id, "q1", {}).updatedAt,
    core.getTopic(topic.id)!.questions[0]!.updatedAt,
  );

  core.saveDraft(topic.id, "q1", { option: "b" });
  core.saveDraft(topic.id, "q2", { text: "x" });
  core.setQuestionStatus(topic.id, "q2", "suspended", "later");
  assert.equal(core.clearDrafts(topic.id), 1);
  const after = core.getTopic(topic.id)!;
  assert.equal("draft" in after.questions[0]!, false);
  assert.deepEqual(after.questions[1]!.draft, { text: "x" });
  assert.equal(after.questions[1]!.note, "later");
  assert.equal("note" in core.setQuestionStatus(topic.id, "q2", "open", ""), false);

  const answered = core.answerQuestion(topic.id, "q2", "Done", "board");
  assert.equal(answered.status, "answered");
  assert.equal("draft" in answered, false);
  assert.equal(core.exportAnswers(topic.id), "## Answers — Rules\n\n- **q2** (round 1): Done");
  assert.throws(() => core.answerQuestion(topic.id, "q9", "x", "chat"), /no question 'q9'/);
  assert.throws(
    () => core.createTopic({ id: topic.id, title: "x", categories: ["a"] }),
    /call get_topic or pick another id/,
  );
});
