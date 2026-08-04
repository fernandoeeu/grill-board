/**
 * Domain types for Grill Board.
 *
 * Single source of truth shared by the data-access layer, the server
 * functions and the MCP tools. No imports on purpose: this module must stay
 * dependency-free so every layer can use it.
 */

export type TopicStatus = 'active' | 'archived';

export type QuestionStatus = 'open' | 'answered' | 'suspended' | 'pending_facts';

/** Where an answer came from: recorded by an agent in chat, or typed on the board. */
export type AnsweredVia = 'chat' | 'board';

/** Auto-saved, unsubmitted answer: a picked quick option and/or free text. */
export interface Draft {
  option?: string;
  text?: string;
}

/**
 * 'grill' is a normal wave of questions. 'confirmation' carries the agent's
 * consolidated understanding (`synthesis`) plus a single gate question; the
 * last confirmation answered "confirmed" concludes the grill.
 */
export type RoundKind = 'grill' | 'confirmation';

export interface Round {
  id: string;
  topicId: string;
  number: number;
  title?: string;
  kind: RoundKind;
  /** Markdown. Only present on confirmation rounds. */
  synthesis?: string;
  createdAt: number;
}

export interface Question {
  /** Short id, unique within topic, e.g. 'q1'. */
  id: string;
  topicId: string;
  roundId: string;
  roundNumber: number;
  category: string;
  status: QuestionStatus;
  text: string;
  recommendation?: string;
  /** The entry of `options` the agent recommends; the board highlights that pill. */
  recommendedOption?: string;
  options?: string[];
  note?: string;
  answer?: string;
  /** Provenance of `answer`; absent while the question has no answer. */
  answeredVia?: AnsweredVia;
  draft?: Draft;
  position: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Progress counters.
 *
 * Rule (one implementation, in the db layer): `total` counts questions with
 * status `open` or `answered`; `done` counts, of those, the ones that are
 * `answered` or carry a non-empty draft (`draft.option` or `draft.text`);
 * `percent` is `total ? round(done / total * 100) : 0`.
 */
export interface Progress {
  done: number;
  total: number;
  percent: number;
}

export interface TopicSummary {
  id: string;
  title: string;
  context?: string;
  /** Ordered; same list the board detail exposes. */
  categories: string[];
  status: TopicStatus;
  progress: Progress;
  /** How many rounds the topic has, empty ones included. */
  roundCount: number;
  /** Questions still with status `open`, drafts included. Drives the sidebar dot. */
  openCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface TopicDetail {
  id: string;
  title: string;
  context?: string;
  /** Ordered; drives the order of the category sections on the board. */
  categories: string[];
  status: TopicStatus;
  rounds: Round[];
  questions: Question[];
  progress: Progress;
  createdAt: number;
  updatedAt: number;
}

/** Input shape for batch question creation; the db layer fills the rest. */
export interface NewQuestion {
  id?: string;
  category: string;
  text: string;
  recommendation?: string;
  /** Must match one of `options` verbatim. */
  recommendedOption?: string;
  options?: string[];
  note?: string;
  status?: QuestionStatus;
}

/** A question still awaiting an answer, carried with its topic for context. */
export interface PendingQuestion {
  topicId: string;
  topicTitle: string;
  question: Question;
}
