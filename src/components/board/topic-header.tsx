/**
 * Sticky board header (spec 4.3): eyebrow, topic title, context line, progress
 * bar and the two management triggers.
 *
 * It is `sticky top-0` inside the sidebar inset, so it spans the board column
 * and never slides under the sidebar.
 */

import { Progress } from '@/components/ui/progress'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
  AddQuestionsDialog,
  AddRoundDialog,
} from '@/components/board/manage-dialogs'

import type { TopicDetail } from '@/lib/types'

export function TopicHeader({ topic }: { topic: TopicDetail }) {
  const { done, total, percent } = topic.progress

  return (
    <header className="sticky top-0 z-30 border-b border-stone-100 bg-white/85 backdrop-blur">
      <div className="mx-auto max-w-3xl px-6 py-5">
        <div className="flex items-center gap-3">
          {/* The sidebar's own trigger goes away with it, so the board keeps one. */}
          <SidebarTrigger className="-ml-1 text-stone-400" />
          <span className="text-[11px] font-semibold tracking-[0.16em] text-stone-400 uppercase">
            Grill
          </span>
          {topic.status === 'archived' && (
            <span className="text-[11px] font-semibold tracking-[0.16em] text-stone-400 uppercase">
              archived
            </span>
          )}
        </div>

        <h1 className="mt-2 text-xl leading-snug font-semibold tracking-tight text-stone-900 sm:text-2xl">
          {topic.title}
        </h1>

        {topic.context && (
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            {topic.context}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Progress
            value={percent}
            aria-label="Questions answered"
            className="w-40"
          />
          <span className="text-sm text-stone-500">
            {done} of {total} questions answered
          </span>
          <span className="grow" />
          <div className="flex items-center gap-2">
            <AddRoundDialog topicId={topic.id} />
            <AddQuestionsDialog topic={topic} />
          </div>
        </div>
      </div>
    </header>
  )
}
