/**
 * The board for one topic.
 *
 * The loader warms the TanStack Query cache; the component reads the same
 * query with `useSuspenseQuery`, so a 2s poll (see `topicQueryOptions`) keeps
 * agent-made changes on screen without a manual refresh.
 */

import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

import { ActionBar } from '@/components/board/action-bar'
import { RoundNavigator } from '@/components/board/round-navigator'
import { RoundSection } from '@/components/board/round-section'
import { TopicHeader } from '@/components/board/topic-header'
import { groupByRound } from '@/lib/board'
import { topicQueryOptions } from '@/lib/queries'

export const Route = createFileRoute('/topics/$topicId')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(topicQueryOptions(params.topicId)),
  component: TopicBoard,
})

function TopicBoard() {
  const { topicId } = Route.useParams()
  const { data: topic } = useSuspenseQuery(topicQueryOptions(topicId))

  const questions = topic?.questions
  const rounds = topic?.rounds

  const sections = useMemo(
    () => groupByRound(questions ?? [], rounds ?? []),
    [questions, rounds],
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

      <RoundNavigator rounds={topic.rounds} questions={topic.questions} />

      <main className="mx-auto w-full max-w-3xl px-6 pt-10 pb-40">
        {sections.length === 0 ? (
          <p className="mt-16 text-center text-sm text-stone-400">
            No questions yet.
          </p>
        ) : (
          sections.map((section) => (
            <RoundSection
              key={section.round.id}
              topicId={topic.id}
              round={section.round}
              questions={section.questions}
              categories={topic.categories}
            />
          ))
        )}
      </main>

      <ActionBar topic={topic} />
    </>
  )
}
