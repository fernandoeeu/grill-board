/**
 * Board grouping, shared by the board route and the Round Navigator.
 *
 * Both must see the very same sections, otherwise a section renders without a
 * tick and the scroll-spy never marks it.
 */

import type { Question, Round } from '@/lib/types'

export interface RoundSectionData {
  round: Round
  questions: Question[]
}

const byPosition = (a: Question, b: Question) => a.position - b.position

/**
 * Groups the questions into one section per round, rounds by `number` and
 * questions by `position`. Empty rounds are dropped. A question whose round is
 * missing from `rounds` would otherwise never render, so it lands in a
 * trailing synthetic section instead of disappearing.
 */
export function groupByRound(
  questions: Question[],
  rounds: Round[],
): RoundSectionData[] {
  const grouped = new Map<string, Question[]>()
  for (const question of questions) {
    const bucket = grouped.get(question.roundId)
    if (bucket) bucket.push(question)
    else grouped.set(question.roundId, [question])
  }

  const declared = [...rounds]
    .sort((a, b) => a.number - b.number)
    .map((round) => ({
      round,
      questions: (grouped.get(round.id) ?? []).sort(byPosition),
    }))
    // An empty grill round is invisible noise; an empty confirmation round is
    // a synthesis whose gate question is still on its way — keep it on screen.
    .filter(
      (section) =>
        section.questions.length > 0 || section.round.kind === 'confirmation',
    )

  const known = new Set(rounds.map((round) => round.id))
  const orphans = [...grouped.entries()]
    .filter(([roundId]) => !known.has(roundId))
    .map(([roundId, items]) => {
      const sorted = [...items].sort(byPosition)
      const round: Round = {
        id: roundId,
        topicId: sorted[0].topicId,
        number: sorted[0].roundNumber,
        kind: 'grill',
        createdAt: sorted[0].createdAt,
      }
      return { round, questions: sorted }
    })
    .sort((a, b) => a.round.number - b.round.number)

  return [...declared, ...orphans]
}

/** Answered, or holding a draft: the one rule used by every progress readout. */
export function isSettled(question: Question): boolean {
  return (
    question.status === 'answered' ||
    Boolean(question.draft?.option) ||
    Boolean(question.draft?.text)
  )
}

export function answeredCount(questions: Question[]): number {
  return questions.filter(isSettled).length
}
