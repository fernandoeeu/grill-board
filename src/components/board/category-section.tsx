/**
 * One category block (spec 4.3): uppercase label, count, hairline rule, cards.
 * The board decides which sections exist and in which order; this component
 * only renders the questions it is handed.
 */

import { QuestionCard } from '@/components/board/question-card'

import type { Question } from '@/lib/types'

export function CategorySection({
  topicId,
  category,
  questions,
  categories,
}: {
  topicId: string
  category: string
  questions: Question[]
  /** The topic's declared categories, offered when a question is edited. */
  categories?: string[]
}) {
  return (
    <section className="mt-14 first:mt-0">
      <div className="flex items-baseline gap-3">
        <h2 className="text-[11px] font-semibold tracking-[0.16em] text-stone-500 uppercase">
          {category}
        </h2>
        <span className="text-xs text-stone-300">{questions.length}</span>
        <div className="h-px grow bg-stone-100" />
      </div>
      <div className="mt-5 space-y-4">
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
