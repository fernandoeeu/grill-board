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
import { Progress } from '@/components/ui/progress'
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
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { invalidateTopicQueries, topicsQueryOptions } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { setTopicArchivedFn } from '@/server/functions/grill'

import type { TopicSummary } from '@/lib/types'

const EYEBROW = 'text-[11px] font-semibold tracking-[0.16em] uppercase'

/** Thin progress bar of the §4.4 board, sized for a sidebar row. */
const SIDEBAR_PROGRESS =
  'w-full min-w-0 flex-1 gap-0 [&_[data-slot=progress-track]]:h-1 [&_[data-slot=progress-track]]:bg-stone-100 [&_[data-slot=progress-indicator]]:rounded-full [&_[data-slot=progress-indicator]]:bg-accent-600'

export function AppSidebar() {
  const { data: topics } = useSuspenseQuery(topicsQueryOptions())
  const queryClient = useQueryClient()
  const [isNewTopicOpen, setNewTopicOpen] = useState(false)
  const [isArchivedOpen, setArchivedOpen] = useState(false)

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
  const archivedTopics = topics.filter((topic) => topic.status === 'archived')

  return (
    <>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="gap-0 px-3 pt-4 pb-2">
          <div className="flex items-center justify-between gap-2">
            <span className={cn(EYEBROW, 'text-stone-400')}>Grill Board</span>
            <SidebarTrigger className="-mr-1 text-stone-400" />
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className={cn(EYEBROW, 'text-stone-500')}>
              Topics
            </SidebarGroupLabel>
            <SidebarGroupContent>
              {activeTopics.length === 0 ? (
                <p className="px-2 py-1.5 text-sm leading-relaxed text-stone-400">
                  No topics yet.
                </p>
              ) : (
                <SidebarMenu className="gap-1">
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

          {archivedTopics.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel
                elementType="button"
                aria-expanded={isArchivedOpen}
                onClick={() => setArchivedOpen((open) => !open)}
                className={cn(EYEBROW, 'w-full cursor-pointer gap-1.5 text-stone-500')}
              >
                <ChevronRightIcon
                  className={cn('transition-transform', isArchivedOpen && 'rotate-90')}
                />
                Archived
                <span className="text-xs tracking-normal text-stone-300 normal-case">
                  {archivedTopics.length}
                </span>
              </SidebarGroupLabel>
              {isArchivedOpen && (
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    {archivedTopics.map((topic) => (
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
            className="h-auto flex-1 rounded-full bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-800"
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
  const { done, total, percent } = topic.progress

  const href = router.buildLocation({
    to: '/topics/$topicId',
    params: { topicId: topic.id },
  }).href
  const isActive = Boolean(
    matchRoute({ to: '/topics/$topicId', params: { topicId: topic.id } }),
  )

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        href={href}
        isActive={isActive}
        className={cn(
          'h-auto flex-col items-start gap-1.5 py-2',
          topic.status === 'archived' && 'opacity-60',
        )}
      >
        <span className="w-full truncate text-sm leading-snug">{topic.title}</span>
        <div className="flex w-full items-center gap-2">
          <Progress
            value={percent}
            aria-label={`${done} of ${total} questions answered`}
            className={SIDEBAR_PROGRESS}
          />
          <span className="font-mono text-[11px] text-stone-400 tabular-nums">
            {done}/{total}
          </span>
        </div>
      </SidebarMenuButton>

      <DropdownMenuTrigger>
        <SidebarMenuAction
          showOnHover
          aria-label={`Actions for ${topic.title}`}
          className="top-2 text-stone-400"
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
