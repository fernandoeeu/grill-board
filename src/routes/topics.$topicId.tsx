/**
 * The board for one topic.
 *
 * The loader warms the TanStack Query cache; the component reads the same
 * query with `useSuspenseQuery`, so a 2s poll (see `topicQueryOptions`) keeps
 * agent-made changes on screen without a manual refresh.
 */

import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

import { ActionBar } from '@/components/board/action-bar'
import { CategorySection } from '@/components/board/category-section'
import { RoundFilter } from '@/components/board/round-filter'
import { TopicHeader } from '@/components/board/topic-header'
import { topicQueryOptions } from '@/lib/queries'

import type { Question } from '@/lib/types'

export const Route = createFileRoute('/topics/$topicId')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(topicQueryOptions(params.topicId)),
  component: TopicBoard,
})

interface Section {
  category: string
  questions: Question[]
}

/**
 * Groups the visible questions into sections, in the topic's declared category
 * order. Empty categories are dropped. A question whose category is not
 * declared would otherwise never render, so those land in a trailing section
 * instead of disappearing.
 */
function groupByCategory(
  questions: Question[],
  categories: string[],
): Section[] {
  const grouped = new Map<string, Question[]>()
  for (const question of questions) {
    const bucket = grouped.get(question.category)
    if (bucket) bucket.push(question)
    else grouped.set(question.category, [question])
  }

  const declared = categories
    .map((category) => ({
      category,
      questions: grouped.get(category) ?? [],
    }))
    .filter((section) => section.questions.length > 0)

  const undeclared = [...grouped.entries()]
    .filter(([category]) => !categories.includes(category))
    .map(([category, items]) => ({ category, questions: items }))

  return [...declared, ...undeclared]
}

function TopicBoard() {
  const { topicId } = Route.useParams()
  const { data: topic } = useSuspenseQuery(topicQueryOptions(topicId))
  const [activeRound, setActiveRound] = useState<number | null>(null)

  const questions = topic?.questions
  const categories = topic?.categories

  const visible = useMemo(
    () =>
      activeRound === null
        ? (questions ?? [])
        : (questions ?? []).filter(
            (question) => question.roundNumber === activeRound,
          ),
    [questions, activeRound],
  )

  const sections = useMemo(
    () => groupByCategory(visible, categories ?? []),
    [visible, categories],
  )

  if (!topic) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 pt-24 pb-40 text-center">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-stone-400 uppercase">
          Grill
        </p>
        <p className="mt-4 text-sm text-stone-400">
          No topic with id{' '}
          <span className="font-mono text-stone-500">{topicId}</span>. Pick one
          from the sidebar, or ask an agent to create it.
        </p>
      </main>
    )
  }

  return (
    <>
      <TopicHeader topic={topic} />

      <main className="mx-auto w-full max-w-3xl px-6 pt-10 pb-40">
        <RoundFilter
          rounds={topic.rounds}
          active={activeRound}
          onChange={setActiveRound}
        />

        <div className="mt-10">
          {sections.length === 0 ? (
            <p className="mt-16 text-center text-sm text-stone-400">
              No questions in this round.
            </p>
          ) : (
            sections.map((section) => (
              <CategorySection
                key={section.category}
                topicId={topic.id}
                category={section.category}
                questions={section.questions}
                categories={topic.categories}
              />
            ))
          )}
        </div>
      </main>

      <ActionBar topic={topic} />
    </>
  )
}
