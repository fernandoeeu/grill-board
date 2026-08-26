import type { Draft, Progress, Question } from "@/lib/types";

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
    if (question.status === "answered" || hasContent(question.draft)) done += 1;
  }

  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** A draft counts only when the picked option or the typed text is non-empty. */
function hasContent(draft: Draft | undefined): boolean {
  if (draft === undefined) return false;
  return (draft.option ?? "").trim() !== "" || (draft.text ?? "").trim() !== "";
}
