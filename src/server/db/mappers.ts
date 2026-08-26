import type {
  AnsweredVia,
  Draft,
  Question,
  QuestionStatus,
  Round,
  RoundKind,
  TopicStatus,
} from "@/lib/types";

/**
 * Row shapes and row-to-domain mappers.
 *
 * Rows are the raw snake_case columns of the schema. The enum columns are typed
 * on their domain unions because the schema has a CHECK constraint on each one.
 * Mappers drop absent optional fields instead of carrying `null` into the
 * domain objects, so the MCP tools return compact JSON.
 */

export interface TopicRow {
  id: string;
  title: string;
  context: string | null;
  /** JSON array of strings, ordered. */
  categories: string;
  status: TopicStatus;
  created_at: number;
  updated_at: number;
}

export interface RoundRow {
  id: string;
  topic_id: string;
  number: number;
  title: string | null;
  kind: RoundKind;
  synthesis: string | null;
  created_at: number;
}

export interface QuestionRow {
  id: string;
  topic_id: string;
  round_id: string;
  /** From the JOIN on `rounds`: `SELECT q.*, r.number AS round_number`. */
  round_number: number;
  category: string;
  status: QuestionStatus;
  text: string;
  recommendation: string | null;
  recommended_option: string | null;
  /** JSON array of quick-pick strings. */
  options: string | null;
  note: string | null;
  answer: string | null;
  answered_via: AnsweredVia | null;
  /** JSON `{ option?, text? }`. */
  draft: string | null;
  position: number;
  created_at: number;
  updated_at: number;
}

export function mapRoundRow(row: RoundRow): Round {
  return {
    id: row.id,
    topicId: row.topic_id,
    number: row.number,
    ...(row.title === null ? {} : { title: row.title }),
    kind: row.kind,
    ...(row.synthesis === null ? {} : { synthesis: row.synthesis }),
    createdAt: row.created_at,
  };
}

export function mapQuestionRow(row: QuestionRow): Question {
  const options = parseOptions(row.options);
  const draft = parseDraft(row.draft);

  return {
    id: row.id,
    topicId: row.topic_id,
    roundId: row.round_id,
    roundNumber: row.round_number,
    category: row.category,
    status: row.status,
    text: row.text,
    ...(row.recommendation === null ? {} : { recommendation: row.recommendation }),
    ...(row.recommended_option === null ? {} : { recommendedOption: row.recommended_option }),
    ...(options === undefined ? {} : { options }),
    ...(row.note === null ? {} : { note: row.note }),
    ...(row.answer === null ? {} : { answer: row.answer }),
    ...(row.answered_via === null ? {} : { answeredVia: row.answered_via }),
    ...(draft === undefined ? {} : { draft }),
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseOptions(value: string | null): string[] | undefined {
  if (value === null) return undefined;
  const parsed = parseJson(value);
  if (!Array.isArray(parsed)) return undefined;
  return parsed.filter((item): item is string => typeof item === "string");
}

function parseDraft(value: string | null): Draft | undefined {
  if (value === null) return undefined;
  const parsed = parseJson(value);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return undefined;

  const raw = parsed as Record<string, unknown>;
  const option = typeof raw.option === "string" ? raw.option : "";
  const text = typeof raw.text === "string" ? raw.text : "";
  if (option === "" && text === "") return undefined;

  return {
    ...(option === "" ? {} : { option }),
    ...(text === "" ? {} : { text }),
  };
}

/** A corrupt JSON column must not take the whole board down. */
function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}
