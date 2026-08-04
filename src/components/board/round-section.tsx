/**
 * One round block (decision 6): "Round N" label, the round progress, a hairline
 * rule, then the round's cards in board order (`position`).
 *
 * The section carries `data-round-id` and every card carries `data-question-id`
 * so the Round Navigator can find its scroll targets.
 */

import { Markdown } from '@/components/board/markdown'
import { QuestionCard } from '@/components/board/question-card'
import { answeredCount } from '@/lib/board'
import { cn } from '@/lib/utils'

import type { Question, Round } from '@/lib/types'

export function RoundSection({
  topicId,
  round,
  questions,
  categories,
}: {
  topicId: string
  round: Round
  /** The round's questions, already sorted by `position`. */
  questions: Question[]
  /** The topic's declared categories, offered when a question is edited. */
  categories?: string[]
}) {
  const isConfirmation = round.kind === 'confirmation'

  return (
    <section
      data-round-id={round.id}
      className={cn(
        'mt-14 min-w-0 scroll-mt-48 first:mt-0',
        // The confirmation round is the gate of the grill: it gets its own
        // accent-tinted container so it reads as a distinct moment in the
        // timeline, not one more wave of questions.
        isConfirmation && '-mx-4 rounded-2xl bg-accent-50/60 p-4 ring-1 ring-accent-200 sm:-mx-5 sm:p-5',
      )}
    >
      <div className="flex items-baseline gap-3">
        <h2
          className={cn(
            'min-w-0 text-[11px] font-semibold tracking-[0.16em] break-words uppercase',
            isConfirmation ? 'text-accent-700' : 'text-stone-500',
          )}
        >
          {isConfirmation
            ? `Confirmation — Round ${round.number}`
            : `Round ${round.number}`}
          {round.title && !isConfirmation ? ` — ${round.title}` : ''}
        </h2>
        <span className="shrink-0 text-xs text-stone-400 tabular-nums">
          {answeredCount(questions)}/{questions.length}
        </span>
        <div
          className={cn(
            'h-px min-w-0 grow',
            isConfirmation ? 'bg-accent-200' : 'bg-stone-100',
          )}
        />
      </div>
      {isConfirmation && round.synthesis ? (
        <div className="mt-5 min-w-0 rounded-xl bg-white p-6 ring-1 ring-accent-100 sm:p-7">
          <Markdown source={round.synthesis} />
        </div>
      ) : null}
      <div className="mt-5 min-w-0 space-y-4">
        {questions.map((question) => (
          <QuestionCard
            key={question.id}
            topicId={topicId}
            question={question}
            categories={categories}
          />
        ))}
      </div>
    </section>
  )
}
