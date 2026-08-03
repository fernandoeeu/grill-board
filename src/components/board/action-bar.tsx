/**
 * Action bar — pinned to the bottom of the board.
 *
 * Left: how much of the topic is done. Right: copy every draft answer as
 * Markdown, and clear the topic's drafts behind a two-step confirmation.
 *
 * Render it as the LAST child of `SidebarInset`, outside the `max-w-3xl`
 * column: it is sticky, so it pins itself to the viewport while the board
 * scrolls and stays inside the sidebar inset instead of over it.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { draftAsText } from '@/components/board/answer-form';
import {
  ARMED_BUTTON,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
} from '@/components/board/button-styles';
import { Button } from '@/components/ui/button';
import { invalidateTopicQueries } from '@/lib/queries';
import type { TopicDetail } from '@/lib/types';
import { cn } from '@/lib/utils';
import { clearDraftsFn } from '@/server/functions/grill';

/** How long the clear button stays armed before it disarms itself. */
const ARM_WINDOW_MS = 4000;

/**
 * The Markdown an agent reads back: only `open` questions carrying a draft, in
 * the topic's stored question order, ignoring the round filter. `null` when
 * there is nothing to copy.
 */
function buildMarkdown(topic: TopicDetail): string | null {
  const lines = [`## Answers — ${topic.title}`, ''];
  let count = 0;
  for (const question of topic.questions) {
    if (question.status !== 'open') continue;
    const answer = draftAsText(question.draft);
    if (!answer) continue;
    count += 1;
    lines.push(`- **${question.id}** (round ${question.roundNumber}): ${answer}`);
  }
  return count > 0 ? lines.join('\n') : null;
}

export function ActionBar({ topic }: { topic: TopicDetail }) {
  const queryClient = useQueryClient();
  const [armed, setArmed] = useState(false);
  const armRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (armRef.current) clearTimeout(armRef.current);
    },
    [],
  );

  const markdown = useMemo(() => buildMarkdown(topic), [topic]);
  const hasDrafts = useMemo(
    () => topic.questions.some((question) => draftAsText(question.draft) !== ''),
    [topic.questions],
  );

  const clearDrafts = useMutation({
    mutationFn: () => clearDraftsFn({ data: { topicId: topic.id } }),
    onSuccess: async () => {
      await invalidateTopicQueries(queryClient, topic.id);
      toast('Drafts cleared.');
    },
    onError: () => toast('Could not clear the drafts.'),
  });

  function toggleClear() {
    if (armRef.current) {
      clearTimeout(armRef.current);
      armRef.current = null;
    }
    if (!armed) {
      setArmed(true);
      armRef.current = setTimeout(() => {
        armRef.current = null;
        setArmed(false);
      }, ARM_WINDOW_MS);
      return;
    }
    setArmed(false);
    clearDrafts.mutate();
  }

  async function copyAnswers() {
    if (!markdown) {
      toast('Nothing answered yet.');
      return;
    }
    try {
      await navigator.clipboard.writeText(markdown);
      toast('Answers copied.');
    } catch {
      toast('Could not copy.');
    }
  }

  return (
    <div className="sticky bottom-0 z-40 mt-auto w-full border-t border-stone-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
        <span className="text-xs text-stone-400">
          {topic.progress.done} of {topic.progress.total} answered
        </span>
        <span className="grow" />
        <Button
          type="button"
          isDisabled={!hasDrafts || clearDrafts.isPending}
          onPress={() => toggleClear()}
          className={cn(SECONDARY_BUTTON, armed && ARMED_BUTTON)}
        >
          {armed ? 'Confirm clear' : 'Clear drafts'}
        </Button>
        <Button
          type="button"
          isDisabled={markdown === null}
          onPress={() => void copyAnswers()}
          className={PRIMARY_BUTTON}
        >
          Copy answers
        </Button>
      </div>
    </div>
  );
}
