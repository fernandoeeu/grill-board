/**
 * Answer form — rendered by `QuestionCard` on `open` questions only.
 *
 * Quick-pick pills (single select, clicking the active one deselects) plus a
 * free-text field. Every change auto-saves to SQLite: a pill saves at once, the
 * text field after a short debounce. A "Record answer" action turns the draft
 * into the recorded answer, with `answeredVia: 'board'`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { PRIMARY_BUTTON } from '@/components/board/button-styles';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { invalidateTopicQueries } from '@/lib/queries';
import type { Draft, Question } from '@/lib/types';
import { cn } from '@/lib/utils';
import { answerQuestionFn, saveDraftFn } from '@/server/functions/grill';

/** Debounce of the free-text field. A pill click does not wait. */
const DRAFT_DEBOUNCE_MS = 400;

/** How long the quiet "saved" flash stays lit. */
const SAVED_FLASH_MS = 1400;

const PILL_BASE =
  // `max-w-full` + wrapping text keep a long option inside the card: the shadcn
  // button base is `shrink-0 whitespace-nowrap`, which would otherwise widen the
  // page instead of breaking the label.
  'fade h-auto max-w-full min-w-0 shrink cursor-pointer rounded-full border px-4 py-2 text-left text-sm font-medium break-words whitespace-normal';

const PILL_ACTIVE =
  'border-accent-600 bg-accent-600 text-white shadow-sm hover:bg-accent-600';

const PILL_IDLE =
  'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-700';

/** Idle look of the pill the agent recommends: quietly accent-tinted. */
const PILL_RECOMMENDED =
  'border-accent-200 bg-accent-50/60 text-stone-700 hover:border-accent-300 hover:bg-accent-50 hover:text-stone-700';

/**
 * Flattens a draft into the one sentence it stands for: picked option first,
 * free text second, joined by a spaced em dash. Empty when the draft is empty.
 */
export function draftAsText(draft: Draft | undefined): string {
  if (!draft) return '';
  return [draft.option, draft.text?.trim()].filter(Boolean).join(' — ');
}

export function AnswerForm({
  topicId,
  question,
}: {
  topicId: string;
  question: Question;
}) {
  const queryClient = useQueryClient();
  const questionId = question.id;
  const serverOption = question.draft?.option ?? '';
  const serverText = question.draft?.text ?? '';

  const [option, setOption] = useState(serverOption);
  const [text, setText] = useState(serverText);
  const [flashing, setFlashing] = useState(false);

  const focusedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(0);

  // The board polls every two seconds. A poll must never overwrite what the
  // human is doing, so the server draft is adopted only while this form is
  // idle: not focused, nothing queued, nothing in flight.
  useEffect(() => {
    if (focusedRef.current) return;
    if (debounceRef.current !== null || inFlightRef.current > 0) return;
    setOption(serverOption);
    setText(serverText);
  }, [serverOption, serverText]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (flashRef.current) clearTimeout(flashRef.current);
    },
    [],
  );

  const flashSaved = useCallback(() => {
    setFlashing(true);
    if (flashRef.current) clearTimeout(flashRef.current);
    flashRef.current = setTimeout(() => setFlashing(false), SAVED_FLASH_MS);
  }, []);

  const { mutate: mutateDraft } = useMutation({
    mutationFn: (draft: Draft | null) =>
      saveDraftFn({ data: { topicId, questionId, draft } }),
    onMutate: () => {
      inFlightRef.current += 1;
    },
    onSuccess: () => flashSaved(),
    onError: () => toast('Could not save the draft.'),
    onSettled: async () => {
      await invalidateTopicQueries(queryClient, topicId);
      inFlightRef.current -= 1;
    },
  });

  const cancelQueuedSave = useCallback(() => {
    if (debounceRef.current === null) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = null;
  }, []);

  const save = useCallback(
    (nextOption: string, nextText: string) => {
      const trimmed = nextText.trim();
      // An empty draft is stored as NULL, never as an empty object: an empty
      // object would count as "done" in the progress bar.
      const draft: Draft | null =
        !nextOption && !trimmed
          ? null
          : {
              ...(nextOption ? { option: nextOption } : {}),
              ...(trimmed ? { text: trimmed } : {}),
            };
      mutateDraft(draft);
    },
    [mutateDraft],
  );

  function pickOption(value: string) {
    const next = option === value ? '' : value;
    setOption(next);
    cancelQueuedSave();
    save(next, text);
  }

  function changeText(value: string) {
    setText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      save(option, value);
    }, DRAFT_DEBOUNCE_MS);
  }

  const answer = draftAsText({ option, text });

  const recordAnswer = useMutation({
    mutationFn: (value: string) =>
      answerQuestionFn({
        data: { topicId, questionId, answer: value, answeredVia: 'board' },
      }),
    onSuccess: async () => {
      await invalidateTopicQueries(queryClient, topicId);
      toast('Answer recorded.');
    },
    onError: () => toast('Could not record the answer.'),
  });

  function record() {
    if (!answer) return;
    // The answer supersedes the draft; a late auto-save would resurrect it.
    cancelQueuedSave();
    recordAnswer.mutate(answer);
  }

  const textareaId = `text-${questionId}`;
  const options = question.options ?? [];

  return (
    <div className="mt-6 border-t border-stone-100 pt-5">
      {options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {options.map((value) => {
            const active = value === option;
            const recommended = value === question.recommendedOption;
            return (
              <Button
                key={value}
                type="button"
                aria-pressed={active}
                onPress={() => pickOption(value)}
                className={cn(
                  PILL_BASE,
                  active ? PILL_ACTIVE : recommended ? PILL_RECOMMENDED : PILL_IDLE,
                )}
              >
                {value}
                {recommended && (
                  <span
                    className={cn(
                      'ml-1.5 text-[10px] font-semibold tracking-[0.08em] uppercase',
                      active ? 'text-white/75' : 'text-accent-700',
                    )}
                  >
                    rec
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      )}

      <div className="mt-4">
        <Label
          htmlFor={textareaId}
          className="text-[11px] font-semibold tracking-[0.12em] text-stone-400 uppercase"
        >
          Other / elaborate
        </Label>
        <Textarea
          id={textareaId}
          rows={2}
          value={text}
          placeholder="Write here to go beyond the options or add context."
          onChange={(event) => changeText(event.target.value)}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onBlur={() => {
            focusedRef.current = false;
          }}
          className="mt-2 field-sizing-fixed min-h-0 w-full resize-y rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-stone-800 placeholder:text-stone-300 focus:border-accent-600 focus:ring-1 focus:ring-accent-600 focus:outline-none focus-visible:border-accent-600 focus-visible:ring-1 focus-visible:ring-accent-600"
        />
      </div>

      {/* Reserved slot: the flash fades in and out without moving the card. */}
      <div className="mt-2 flex h-4 items-center justify-end">
        <span
          className={cn(
            'fade text-xs text-stone-400',
            flashing ? 'opacity-100' : 'opacity-0',
          )}
        >
          saved
        </span>
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          isDisabled={answer === '' || recordAnswer.isPending}
          onPress={() => record()}
          className={PRIMARY_BUTTON}
        >
          Record answer
        </Button>
      </div>
    </div>
  );
}
