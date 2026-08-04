import { useState } from 'react'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { useMatchRoute, useRouter } from '@tanstack/react-router'
import { ChevronRightIcon, MoreHorizontalIcon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'

import { NewTopicDialog } from '@/components/new-topic-dialog'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { invalidateTopicQueries, topicsQueryOptions } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { setTopicArchivedFn } from '@/server/functions/grill'

import type { TopicSummary } from '@/lib/types'

const EYEBROW = 'text-[11px] font-semibold tracking-[0.16em] uppercase'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

/** Short relative time for the sidebar rows: "now", "9m", "2h", "6d", "3w". */
function shortRelativeTime(timestamp: number, now = Date.now()): string {
  const elapsed = Math.max(0, now - timestamp)
  if (elapsed < MINUTE) return 'now'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`
  if (elapsed < WEEK) return `${Math.floor(elapsed / DAY)}d`
  return `${Math.floor(elapsed / WEEK)}w`
}

/** Absolute date for the hover card, e.g. "3 Aug 2026". */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function AppSidebar() {
  const { data: topics } = useSuspenseQuery(topicsQueryOptions())
  const queryClient = useQueryClient()
  const [isNewTopicOpen, setNewTopicOpen] = useState(false)
  const [isSettledOpen, setSettledOpen] = useState(false)

  const setArchived = useMutation({
    mutationFn: (input: { topicId: string; archived: boolean }) =>
      setTopicArchivedFn({ data: input }),
    onSuccess: (_topic, input) => {
      void invalidateTopicQueries(queryClient, input.topicId)
      toast(input.archived ? 'Topic archived.' : 'Topic restored.')
    },
    onError: () => toast('Could not update the topic.'),
  })

  function toggleArchived(topic: TopicSummary) {
    setArchived.mutate({ topicId: topic.id, archived: topic.status !== 'archived' })
  }

  const activeTopics = topics.filter((topic) => topic.status === 'active')
  const settledTopics = topics.filter((topic) => topic.status === 'archived')

  return (
    <>
      <Sidebar variant="inset" collapsible="offcanvas">
        <SidebarHeader className="gap-0 px-3 pt-4 pb-2">
          <span className={cn(EYEBROW, 'text-stone-500')}>Grill Board</span>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              {activeTopics.length === 0 ? (
                <p className="px-2 py-1.5 text-sm leading-relaxed text-stone-400">
                  No topics yet.
                </p>
              ) : (
                <SidebarMenu className="gap-0.5">
                  {activeTopics.map((topic) => (
                    <TopicItem
                      key={topic.id}
                      topic={topic}
                      onToggleArchive={toggleArchived}
                    />
                  ))}
                </SidebarMenu>
              )}
            </SidebarGroupContent>
          </SidebarGroup>

          {settledTopics.length > 0 && (
            <SidebarGroup className="mt-auto">
              <SidebarGroupLabel
                elementType="button"
                aria-expanded={isSettledOpen}
                onClick={() => setSettledOpen((open) => !open)}
                className={cn(EYEBROW, 'w-full cursor-pointer gap-1.5 text-stone-500')}
              >
                <ChevronRightIcon
                  className={cn('transition-transform', isSettledOpen && 'rotate-90')}
                />
                Settled
                <span className="text-xs tracking-normal text-stone-400 normal-case">
                  {settledTopics.length}
                </span>
              </SidebarGroupLabel>
              {isSettledOpen && (
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">
                    {settledTopics.map((topic) => (
                      <TopicItem
                        key={topic.id}
                        topic={topic}
                        onToggleArchive={toggleArchived}
                      />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter className="flex-row items-center gap-2 px-3 pb-4">
          <Button
            onPress={() => setNewTopicOpen(true)}
            className="h-auto flex-1 rounded-lg bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-800"
          >
            <PlusIcon />
            New topic
          </Button>
          <ThemeToggle />
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <NewTopicDialog isOpen={isNewTopicOpen} onOpenChange={setNewTopicOpen} />
    </>
  )
}

function TopicItem({
  topic,
  onToggleArchive,
}: {
  topic: TopicSummary
  onToggleArchive: (topic: TopicSummary) => void
}) {
  const router = useRouter()
  const matchRoute = useMatchRoute()
  const { done, total } = topic.progress
  // Decision 2: the dot marks questions still `open`, not merely "incomplete".
  const hasOpenQuestions = topic.openCount > 0

  const href = router.buildLocation({
    to: '/topics/$topicId',
    params: { topicId: topic.id },
  }).href
  const isActive = Boolean(
    matchRoute({ to: '/topics/$topicId', params: { topicId: topic.id } }),
  )

  return (
    <SidebarMenuItem>
      <HoverCard>
        <HoverCardTrigger>
          <SidebarMenuButton
            href={href}
            isActive={isActive}
            className={cn(
              'fade h-auto flex-col items-start gap-1 py-2',
              topic.status === 'archived' && 'opacity-60',
            )}
          >
            <span className="w-full truncate text-sm leading-snug">{topic.title}</span>
            <span className="flex w-full items-center gap-1.5 text-[11px] leading-none text-stone-500">
              <span className="tabular-nums">{shortRelativeTime(topic.updatedAt)}</span>
              <span aria-hidden>·</span>
              <span className="font-mono tabular-nums">
                {done}/{total}
              </span>
              {hasOpenQuestions && (
                <>
                  <span className="sr-only">Has open questions</span>
                  <span
                    aria-hidden
                    className="ml-auto size-1.5 shrink-0 rounded-full bg-accent-600/90"
                  />
                </>
              )}
            </span>
          </SidebarMenuButton>
        </HoverCardTrigger>

        <HoverCardContent placement="right top" className="w-80">
          <TopicHoverDetails topic={topic} />
        </HoverCardContent>
      </HoverCard>

      <DropdownMenuTrigger>
        <SidebarMenuAction
          showOnHover
          aria-label={`Actions for ${topic.title}`}
          className="top-2 text-stone-400 group-hover/menu-item:text-sidebar-accent-foreground"
        >
          <MoreHorizontalIcon />
        </SidebarMenuAction>
        <DropdownMenu placement="bottom end">
          <DropdownMenuItem onAction={() => onToggleArchive(topic)}>
            {topic.status === 'archived' ? 'Unarchive topic' : 'Archive topic'}
          </DropdownMenuItem>
        </DropdownMenu>
      </DropdownMenuTrigger>
    </SidebarMenuItem>
  )
}

function TopicHoverDetails({ topic }: { topic: TopicSummary }) {
  const { done, total, percent } = topic.progress

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-sm leading-snug font-medium">{topic.title}</p>

      {topic.context && (
        <p className="line-clamp-4 text-xs leading-relaxed text-stone-500">
          {topic.context}
        </p>
      )}

      {topic.categories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {topic.categories.map((category) => (
            <span
              key={category}
              className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] leading-tight text-stone-700"
            >
              {category}
            </span>
          ))}
        </div>
      )}

      <div className="h-px bg-stone-100" />

      <p className="font-mono text-[11px] text-stone-500 tabular-nums">
        {done}/{total} answered · {percent}% ·{' '}
        {topic.roundCount === 1 ? '1 round' : `${topic.roundCount} rounds`}
      </p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px] text-stone-400">
        <dt>Created</dt>
        <dd className="tabular-nums">{formatDate(topic.createdAt)}</dd>
        <dt>Updated</dt>
        <dd className="tabular-nums">{formatDate(topic.updatedAt)}</dd>
      </dl>
    </div>
  )
}
