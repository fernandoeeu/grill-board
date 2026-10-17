import assert from "node:assert/strict";
import { test } from "node:test";
import {
  answeredCount,
  applyAnswer,
  applyClearDraft,
  applyDraft,
  applyQuestionPatch,
  applyStatus,
  assertDeclaredCategories,
  assertRecommendedOption,
  buildQuestions,
  canClearDraft,
  computeProgress,
  formatAnswers,
  groupByRound,
  isPendingQuestion,
  nextPosition,
  nextQuestionId,
  nextRoundNumber,
  normalizeDraft,
  normalizeOptions,
  normalizeText,
  resolveRecommendedOption,
  roundIdFor,
  slugify,
  summarizeTopic,
  topicNotFound,
  uniqueTopicId,
} from "./rules.js";
import type { Question } from "./types.js";

function question(overrides: Partial<Question> = {}): Question {
  return {
    id: "q1",
    topicId: "t",
    roundId: "t#r1",
    roundNumber: 1,
    category: "scope",
    status: "open",
    text: "Library or fork?",
    position: 0,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

test("normalisation turns empty values into absent ones", () => {
  assert.equal(normalizeText(""), undefined);
  assert.equal(normalizeText("   "), undefined);
  assert.equal(normalizeText(null), undefined);
  assert.equal(normalizeText(" x "), " x ");
  assert.equal(normalizeOptions([]), undefined);
  assert.equal(normalizeOptions(null), undefined);
  assert.deepEqual(normalizeOptions(["a"]), ["a"]);
  assert.equal(normalizeDraft({ option: " ", text: "" }), undefined);
  assert.equal(normalizeDraft(null), undefined);
  assert.deepEqual(normalizeDraft({ option: "a", text: " " }), { option: "a" });
});

test("topic ids are slugs, de-duplicated", () => {
  assert.equal(slugify("Ambientes efêmeros!"), "ambientes-efemeros");
  assert.equal(slugify("!!!"), "topic");
  const taken = new Set(["ship", "ship-2"]);
  assert.equal(
    uniqueTopicId("Ship", (id) => taken.has(id)),
    "ship-3",
  );
  assert.equal(
    uniqueTopicId("New one", (id) => taken.has(id)),
    "new-one",
  );
});

test("rounds, question ids and positions continue from what exists", () => {
  assert.equal(nextRoundNumber([]), 1);
  assert.equal(nextRoundNumber([1, 3, 2]), 4);
  assert.equal(roundIdFor("t", 2), "t#r2");
  assert.equal(nextQuestionId(new Set()), "q1");
  assert.equal(nextQuestionId(new Set(["q1", "q3"])), "q2");
  assert.equal(nextPosition([]), 0);
  assert.equal(nextPosition([0, 4, 2]), 5);
});

test("buildQuestions assigns ids and positions and validates the batch", () => {
  const built = buildQuestions({
    topicId: "t",
    round: { id: "t#r2", number: 2 },
    items: [
      { category: "scope", text: "A", options: ["x", "y"], recommendedOption: "y", note: "" },
      { id: "custom", category: "scope", text: "B", options: [] },
      { category: "scope", text: "C", status: "suspended" },
    ],
    takenIds: ["q1", "q3"],
    startPosition: 7,
    now: 10,
  });
  assert.deepEqual(
    built.map((q) => [q.id, q.position, q.status]),
    [
      ["q2", 7, "open"],
      ["custom", 8, "open"],
      ["q4", 9, "suspended"],
    ],
  );
  assert.equal(built[0]!.recommendedOption, "y");
  assert.equal("note" in built[0]!, false);
  assert.equal("options" in built[1]!, false);
  assert.equal(built[0]!.roundNumber, 2);

  assert.throws(
    () =>
      buildQuestions({
        topicId: "t",
        round: { id: "t#r1", number: 1 },
        items: [{ id: "q1", category: "scope", text: "dup" }],
        takenIds: ["q1"],
        startPosition: 0,
        now: 0,
        prefix: "grill_",
      }),
    /question 'q1' already exists in topic 't'; use grill_update_question/,
  );
  assert.throws(
    () =>
      buildQuestions({
        topicId: "t",
        round: { id: "t#r1", number: 1 },
        items: [{ category: "scope", text: "x", options: ["a"], recommendedOption: "b" }],
        takenIds: [],
        startPosition: 0,
        now: 0,
      }),
    /recommendedOption 'b' is not one of the options of question 'q1'/,
  );
});

test("recommendedOption must be in options and drops when options change", () => {
  assert.doesNotThrow(() => assertRecommendedOption(undefined, undefined, "q1"));
  assert.throws(() => assertRecommendedOption("a", undefined, "q1"));

  const current = { options: ["a", "b"], recommendedOption: "a" };
  assert.equal(resolveRecommendedOption(current, {}, "q1"), undefined);
  assert.equal(resolveRecommendedOption(current, { options: ["a", "c"] }, "q1"), undefined);
  assert.equal(resolveRecommendedOption(current, { options: ["b", "c"] }, "q1"), null);
  assert.equal(resolveRecommendedOption(current, { options: null }, "q1"), null);
  assert.equal(resolveRecommendedOption(current, { recommendedOption: "b" }, "q1"), "b");
  assert.equal(resolveRecommendedOption(current, { recommendedOption: null }, "q1"), null);
  assert.throws(() =>
    resolveRecommendedOption(current, { options: ["x"], recommendedOption: "a" }, "q1"),
  );
});

test("applyQuestionPatch writes only the keys given and reports no-ops", () => {
  const current = question({ options: ["a", "b"], recommendedOption: "a", note: "n" });
  const same = applyQuestionPatch(current, {}, 5);
  assert.equal(same.changed, false);
  assert.equal(same.question, current);

  const { question: next, changed } = applyQuestionPatch(
    current,
    { options: ["b"], note: null, recommendation: "  " },
    5,
  );
  assert.equal(changed, true);
  assert.deepEqual(next.options, ["b"]);
  assert.equal("recommendedOption" in next, false);
  assert.equal("note" in next, false);
  assert.equal("recommendation" in next, false);
  assert.equal(next.updatedAt, 5);
});

test("status transitions for answer, setStatus and clearDrafts", () => {
  const drafted = applyDraft(question({ note: "keep" }), { option: "a" }, 2);
  assert.deepEqual(drafted.draft, { option: "a" });
  assert.equal("draft" in applyDraft(drafted, { text: " " }, 3), false);

  const answered = applyAnswer(drafted, "Library", "board", 4);
  assert.equal(answered.status, "answered");
  assert.equal(answered.answer, "Library");
  assert.equal(answered.answeredVia, "board");
  assert.equal("draft" in answered, false);

  assert.equal(applyStatus(drafted, "suspended", undefined, 5).note, "keep");
  assert.equal(applyStatus(drafted, "suspended", "why", 5).note, "why");
  assert.equal("note" in applyStatus(drafted, "suspended", "", 5), false);

  assert.equal(canClearDraft(drafted), true);
  assert.equal(canClearDraft(question()), false);
  assert.equal(canClearDraft({ ...drafted, status: "suspended" }), false);
  assert.equal("draft" in applyClearDraft(drafted, 6), false);
});

test("declared categories are checked with a prefixed hint", () => {
  const topic = { id: "t", categories: ["scope", "risk"] };
  assert.doesNotThrow(() => assertDeclaredCategories(topic, ["scope", "risk"]));
  assert.throws(() => assertDeclaredCategories(topic, ["cost", "cost"], "grill_"), {
    message:
      "topic 't' does not declare the category 'cost'; it declares 'scope', 'risk'. " +
      "Use one of those, or call grill_update_topic with the full new category list first.",
  });
  assert.equal(
    topicNotFound("x", "grill_").message,
    "no topic with id 'x'; call grill_list_topics",
  );
  assert.equal(topicNotFound("x").message, "no topic with id 'x'; call list_topics");
});

test("export formats keep only recorded answers, in board order", () => {
  const questions = [
    question({ id: "q2", roundNumber: 2, status: "answered", answer: "Two", answeredVia: "chat" }),
    question({ id: "q1", status: "answered", answer: "One" }),
    question({ id: "q3", draft: { text: "draft" } }),
    question({ id: "q4", status: "answered", answer: "" }),
  ];
  const topic = { id: "t", title: "Ship" };
  assert.equal(
    formatAnswers(topic, questions),
    "## Answers — Ship\n\n- **q1** (round 1): One\n- **q2** (round 2): Two",
  );
  assert.equal(formatAnswers(topic, [], "markdown"), "## Answers — Ship");
  assert.deepEqual(JSON.parse(formatAnswers(topic, questions, "json")), {
    topicId: "t",
    title: "Ship",
    answers: [
      { id: "q1", round: 1, category: "scope", answer: "One" },
      { id: "q2", round: 2, category: "scope", answer: "Two", answeredVia: "chat" },
    ],
  });
});

test("progress, pending and summaries share the same rules", () => {
  const questions = [
    question({ status: "answered" }),
    question({ draft: { option: "a" } }),
    question(),
    question({ status: "suspended" }),
    question({ status: "pending_facts" }),
  ];
  assert.deepEqual(computeProgress(questions), { done: 2, total: 3, percent: 67 });
  assert.deepEqual(computeProgress([]), { done: 0, total: 0, percent: 0 });
  assert.equal(questions.filter((q) => isPendingQuestion(q)).length, 2);
  assert.equal(questions.filter((q) => isPendingQuestion(q, true)).length, 3);

  const summary = summarizeTopic(
    {
      id: "t",
      title: "T",
      context: "",
      categories: ["scope"],
      status: "active",
      createdAt: 1,
      updatedAt: 2,
    },
    questions,
    1,
  );
  assert.equal("context" in summary, false);
  assert.equal(summary.openCount, 2);
  assert.equal(summary.roundCount, 1);
});

test("board helpers group by round and count settled questions", () => {
  const rounds = [
    { id: "t#r2", topicId: "t", number: 2, kind: "grill" as const, createdAt: 1 },
    { id: "t#r1", topicId: "t", number: 1, kind: "grill" as const, createdAt: 1 },
  ];
  const questions = [
    question({ id: "q2", roundId: "t#r2", roundNumber: 2, status: "answered" }),
    question({ id: "q1", draft: { text: "x" } }),
    question({ id: "q3" }),
  ];
  assert.deepEqual(
    groupByRound(questions, rounds).map((section) => section.round.number),
    [1, 2],
  );
  assert.equal(answeredCount(questions), 2);
});
