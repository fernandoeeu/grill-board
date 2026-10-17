/**
 * `grill-board/core/rules` — the domain rules, with no storage behind them.
 *
 * Every function here is pure: plain values in, plain values out, no I/O, no
 * clock (callers pass `now`), no driver import. The SQLite adapter of
 * `grill-board/core` is built on these, and any other store (Convex, Postgres,
 * an in-memory map) can reuse them to behave exactly the same way.
 *
 * Functions that can fail throw `Error` / `NotFoundError` with messages written
 * for an agent; the ones that name a tool take the host's tool-name `prefix`.
 */

import { questionIdTaken, toolName } from "./errors.js";
import type {
  AnsweredVia,
  Draft,
  NewQuestion,
  Progress,
  Question,
  QuestionStatus,
  TopicDetail,
  TopicSummary,
} from "./types.js";

/* ------------------------------------------------------------ normalisation */

/** Empty and whitespace-only text is absent, never `''`. `null` is absent too. */
export function normalizeText(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  return value.trim() ? value : undefined;
}

/** An empty option list is absent. `null` is absent too. */
export function normalizeOptions(
  options: readonly string[] | null | undefined,
): string[] | undefined {
  if (!options || options.length === 0) return undefined;
  return [...options];
}

/** A draft with no picked option and no text is not a draft: it is absent. */
export function normalizeDraft(draft: Draft | null | undefined): Draft | undefined {
  if (!draft) return undefined;
  const value: Draft = {};
  if (draft.option && draft.option.trim()) value.option = draft.option;
  if (draft.text && draft.text.trim()) value.text = draft.text;
  if (value.option === undefined && value.text === undefined) return undefined;
  return value;
}

/** A draft counts only when the picked option or the typed text is non-empty. */
export function hasDraftContent(draft: Draft | undefined): boolean {
  if (draft === undefined) return false;
  return (draft.option ?? "").trim() !== "" || (draft.text ?? "").trim() !== "";
}

/* ---------------------------------------------------------------- topic ids */

/** `Ambientes efêmeros!` → `ambientes-efemeros`. Never empty: falls back to `topic`. */
export function slugify(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
  return slug === "" ? "topic" : slug;
}

/**
 * The id a new topic gets when none is given: the slug of its title,
 * de-duplicated as `slug`, `slug-2`, `slug-3`… `isTaken` answers for the ids
 * already in the store (an async store can load the ids starting with
 * `slugify(title)` into a `Set` first).
 */
export function uniqueTopicId(
  title: string,
  isTaken: (id: string) => boolean,
  now: number = Date.now(),
): string {
  const base = slugify(title);
  if (!isTaken(base)) return base;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!isTaken(candidate)) return candidate;
  }
  return `${base}-${now}`;
}

/* ------------------------------------------------------------------- rounds */

/** Rounds are numbered `max(number) + 1`, starting at 1. */
export function nextRoundNumber(existing: Iterable<number>): number {
  let max = 0;
  for (const number of existing) if (number > max) max = number;
  return max + 1;
}

/** The id of round `number` of a topic: `<topicId>#r<number>`. */
export function roundIdFor(topicId: string, number: number): string {
  return `${topicId}#r${number}`;
}

/* ---------------------------------------------------------------- questions */

/** The first free `q<n>` (n ≥ 1) not in `taken`. */
export function nextQuestionId(taken: ReadonlySet<string>): string {
  let counter = 1;
  while (taken.has(`q${counter}`)) counter += 1;
  return `q${counter}`;
}

/** New questions go after the topic's last one: `max(position) + 1`, starting at 0. */
export function nextPosition(positions: Iterable<number>): number {
  let max = -1;
  for (const position of positions) if (position > max) max = position;
  return max + 1;
}

/** A recommended option is only meaningful when it names one of the pills. */
export function assertRecommendedOption(
  recommendedOption: string | null | undefined,
  options: readonly string[] | null | undefined,
  questionId: string,
): void {
  if (recommendedOption === null || recommendedOption === undefined) return;
  if (!options || !options.includes(recommendedOption)) {
    throw new Error(
      `recommendedOption '${recommendedOption}' is not one of the options of question ` +
        `'${questionId}'; it must match an entry of 'options' verbatim`,
    );
  }
}

/**
 * The board groups questions by the topic's declared categories, so a question
 * in an undeclared category would never be shown. Storage stays permissive;
 * the agent-facing tool layer refuses early and says how to fix it.
 */
export function assertDeclaredCategories(
  topic: Pick<TopicDetail, "id" | "categories">,
  categories: readonly string[],
  prefix = "",
): void {
  const undeclared = [...new Set(categories)].filter((name) => !topic.categories.includes(name));
  if (undeclared.length === 0) return;
  throw new Error(
    `topic '${topic.id}' does not declare the category ${undeclared
      .map((name) => `'${name}'`)
      .join(", ")}; it declares ${topic.categories.map((name) => `'${name}'`).join(", ")}. ` +
      `Use one of those, or call ${toolName("update_topic", prefix)} with the full new category list first.`,
  );
}

/**
 * Builds the questions of one `add_questions` batch, in input order, without
 * storing them: assigns the next free `q<n>` to items without an id, refuses
 * an id already taken in the topic, checks every `recommendedOption`,
 * normalises the optional text fields and appends positions from
 * `startPosition`. Throws on the first invalid item, so a store that writes
 * the result in one transaction writes all of it or nothing.
 */
export function buildQuestions(input: {
  topicId: string;
  round: { id: string; number: number };
  items: readonly NewQuestion[];
  /** Ids already used by the topic's questions. */
  takenIds: Iterable<string>;
  /** Usually `nextPosition(<positions of the topic's questions>)`. */
  startPosition: number;
  now: number;
  prefix?: string;
}): Question[] {
  const { topicId, round, now, prefix = "" } = input;
  const taken = new Set(input.takenIds);
  let position = input.startPosition;

  return input.items.map((item) => {
    let id = item.id;
    if (id === undefined) {
      id = nextQuestionId(taken);
    } else if (taken.has(id)) {
      throw questionIdTaken(topicId, id, prefix);
    }
    taken.add(id);

    const recommendedOption = normalizeText(item.recommendedOption);
    assertRecommendedOption(recommendedOption, item.options, id);

    const question = compact<Question>({
      id,
      topicId,
      roundId: round.id,
      roundNumber: round.number,
      category: item.category,
      status: item.status ?? "open",
      text: item.text,
      recommendation: normalizeText(item.recommendation),
      recommendedOption,
      options: normalizeOptions(item.options),
      note: normalizeText(item.note),
      position,
      createdAt: now,
      updatedAt: now,
    });
    position += 1;
    return question;
  });
}

/**
 * A content edit. Absent keys are left untouched; `null` clears the field.
 * Never touches the status or the answer.
 */
export interface QuestionPatch {
  text?: string;
  recommendation?: string | null;
  recommendedOption?: string | null;
  options?: string[] | null;
  category?: string;
  note?: string | null;
}

/**
 * Where `recommendedOption` goes after a patch: `undefined` leaves it, `null`
 * clears it, a string sets it. Setting it validates against the (new or kept)
 * options; replacing the options without re-stating it silently drops a marker
 * the new list no longer holds.
 */
export function resolveRecommendedOption(
  current: Pick<Question, "options" | "recommendedOption">,
  patch: Pick<QuestionPatch, "options" | "recommendedOption">,
  questionId: string,
): string | null | undefined {
  const effectiveOptions =
    patch.options !== undefined ? (patch.options ?? undefined) : current.options;
  if (patch.recommendedOption !== undefined) {
    const next = normalizeText(patch.recommendedOption);
    assertRecommendedOption(next, effectiveOptions, questionId);
    return next ?? null;
  }
  if (
    patch.options !== undefined &&
    current.recommendedOption !== undefined &&
    !(effectiveOptions ?? []).includes(current.recommendedOption)
  ) {
    return null;
  }
  return undefined;
}

/**
 * Applies a content edit. `changed` is false when the patch carries no key at
 * all: the store should then return `question` as is, without bumping any
 * timestamp.
 */
export function applyQuestionPatch(
  current: Question,
  patch: QuestionPatch,
  now: number,
): { question: Question; changed: boolean } {
  const next: Question = { ...current };
  let changed = false;

  if (patch.text !== undefined) {
    next.text = patch.text;
    changed = true;
  }
  if (patch.category !== undefined) {
    next.category = patch.category;
    changed = true;
  }
  if (patch.recommendation !== undefined) {
    next.recommendation = normalizeText(patch.recommendation);
    changed = true;
  }
  if (patch.options !== undefined) {
    next.options = normalizeOptions(patch.options);
    changed = true;
  }
  if (patch.note !== undefined) {
    next.note = normalizeText(patch.note);
    changed = true;
  }
  const recommendedOption = resolveRecommendedOption(current, patch, current.id);
  if (recommendedOption !== undefined) {
    next.recommendedOption = recommendedOption ?? undefined;
    changed = true;
  }

  if (!changed) return { question: current, changed };
  next.updatedAt = now;
  return { question: compact(next), changed };
}

/**
 * Records an answer: the answer verbatim, its provenance, status `answered`,
 * and the draft dropped. Quick-pick options are kept.
 */
export function applyAnswer(
  question: Question,
  answer: string,
  answeredVia: AnsweredVia,
  now: number,
): Question {
  return compact({
    ...question,
    answer,
    answeredVia,
    status: "answered",
    draft: undefined,
    updatedAt: now,
  });
}

/**
 * Moves a question to another status. A `note` given here REPLACES the stored
 * note (an empty one clears it); `undefined` leaves the note as it was.
 */
export function applyStatus(
  question: Question,
  status: QuestionStatus,
  note: string | undefined,
  now: number,
): Question {
  return compact({
    ...question,
    status,
    ...(note === undefined ? {} : { note: normalizeText(note) }),
    updatedAt: now,
  });
}

/** Saves the auto-saved draft; `null` or an empty draft clears it. */
export function applyDraft(question: Question, draft: Draft | null, now: number): Question {
  return compact({ ...question, draft: normalizeDraft(draft), updatedAt: now });
}

/** `clearDrafts` touches only `open` questions that carry a draft. */
export function canClearDraft(question: Pick<Question, "status" | "draft">): boolean {
  return question.status === "open" && question.draft !== undefined;
}

/** Drops the draft of one question (pair with `canClearDraft`). */
export function applyClearDraft(question: Question, now: number): Question {
  return compact({ ...question, draft: undefined, updatedAt: now });
}

/* -------------------------------------------------------------------- reads */

/** Board order inside a topic: round number, then position, then creation time. */
export function compareQuestions(
  a: Pick<Question, "roundNumber" | "position" | "createdAt">,
  b: Pick<Question, "roundNumber" | "position" | "createdAt">,
): number {
  return a.roundNumber - b.roundNumber || a.position - b.position || a.createdAt - b.createdAt;
}

/** Still waiting on the human: `open`, plus `pending_facts` when asked. */
export function isPendingQuestion(
  question: Pick<Question, "status">,
  includePendingFacts = false,
): boolean {
  return question.status === "open" || (includePendingFacts && question.status === "pending_facts");
}

/** Exported answers: `answered` questions carrying a non-empty answer. Drafts are not answers. */
export function isExportableAnswer(question: Pick<Question, "status" | "answer">): boolean {
  return question.status === "answered" && question.answer !== undefined && question.answer !== "";
}

/** One entry of the JSON export. */
export interface ExportedAnswer {
  id: string;
  round: number;
  category: string;
  answer: string;
  answeredVia?: AnsweredVia;
}

/**
 * The text `export_answers` returns. Takes any questions of the topic: keeps
 * the exportable ones, in board order. Markdown is a list under a
 * `## Answers — <title>` heading; JSON is `{topicId, title, answers}`.
 */
export function formatAnswers(
  topic: { id: string; title: string },
  questions: readonly Question[],
  format: "markdown" | "json" = "markdown",
): string {
  const answered = questions.filter(isExportableAnswer).sort(compareQuestions);

  if (format === "json") {
    const answers: ExportedAnswer[] = answered.map((q) => ({
      id: q.id,
      round: q.roundNumber,
      category: q.category,
      answer: q.answer ?? "",
      ...(q.answeredVia ? { answeredVia: q.answeredVia } : {}),
    }));
    return JSON.stringify({ topicId: topic.id, title: topic.title, answers });
  }

  const heading = `## Answers — ${topic.title}`;
  if (answered.length === 0) return heading;
  const lines = answered.map((q) => `- **${q.id}** (round ${q.roundNumber}): ${q.answer ?? ""}`);
  return [heading, "", ...lines].join("\n");
}

/**
 * The one and only implementation of the progress rule.
 *
 * `total` counts questions whose status is `open` or `answered`; `suspended`
 * and `pending_facts` are out of the count entirely. Of those, a question is
 * `done` when it is `answered` or already carries a non-empty draft.
 */
export function computeProgress(
  questions: ReadonlyArray<Pick<Question, "status" | "draft">>,
): Progress {
  let total = 0;
  let done = 0;

  for (const question of questions) {
    if (question.status !== "open" && question.status !== "answered") continue;
    total += 1;
    if (question.status === "answered" || hasDraftContent(question.draft)) done += 1;
  }

  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** The `list_topics` entry of a topic, from its own fields and its questions. */
export function summarizeTopic(
  topic: Pick<
    TopicSummary,
    "id" | "title" | "context" | "categories" | "status" | "createdAt" | "updatedAt"
  >,
  questions: ReadonlyArray<Pick<Question, "status" | "draft">>,
  roundCount: number,
): TopicSummary {
  return compact<TopicSummary>({
    id: topic.id,
    title: topic.title,
    categories: topic.categories,
    status: topic.status,
    progress: computeProgress(questions),
    roundCount,
    openCount: questions.filter((question) => question.status === "open").length,
    createdAt: topic.createdAt,
    updatedAt: topic.updatedAt,
    context: topic.context === "" ? undefined : topic.context,
  });
}

export {
  NotFoundError,
  questionIdTaken,
  questionNotFound,
  roundNotFound,
  toolName,
  topicIdTaken,
  topicNotFound,
} from "./errors.js";
export { answeredCount, groupByRound, isSettled, type RoundSectionData } from "./board.js";

/* ------------------------------------------------------------------ helpers */

/** Drops the keys whose value is `undefined`: domain objects never carry them. */
function compact<T extends object>(value: T): T {
  for (const key of Object.keys(value) as Array<keyof T>) {
    if (value[key] === undefined) delete value[key];
  }
  return value;
}
