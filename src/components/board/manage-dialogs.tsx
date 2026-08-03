/**
 * Board management surfaces: add a round, add questions, edit a question and
 * move a question between statuses.
 *
 * Every mutation here goes through a server function and then invalidates
 * `['topic', topicId]` and `['topics']`, so the sidebar counters and the board
 * stay in step with agent-made changes.
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { EllipsisIcon, PlusIcon, Trash2Icon } from 'lucide-react'

import { PRIMARY_BUTTON } from '@/components/board/button-styles'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { invalidateTopicQueries } from '@/lib/queries'
import { cn } from '@/lib/utils'
import {
  addQuestionsFn,
  createRoundFn,
  setQuestionStatusFn,
  updateQuestionFn,
} from '@/server/functions/grill'

import type { NewQuestion, Question, QuestionStatus, TopicDetail } from '@/lib/types'

/**
 * Single status -> label + badge map (spec 4.4).
 *
 * The classes are literal `stone`/`accent`/`emerald`/`amber` utilities on
 * purpose: the stylesheet re-points those colour variables under `.dark`, so
 * one class string is correct in both themes.
 */
export const STATUS_META: Record<
  QuestionStatus,
  { label: string; badge: string }
> = {
  open: {
    label: 'open',
    badge: 'bg-accent-50 text-accent-700 ring-1 ring-accent-200',
  },
  answered: {
    label: 'answered',
    badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  },
  suspended: {
    label: 'suspended',
    badge: 'bg-stone-100 text-stone-500 ring-1 ring-stone-200',
  },
  pending_facts: {
    label: 'pending facts',
    badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  },
}

const STATUS_ORDER: QuestionStatus[] = [
  'open',
  'answered',
  'suspended',
  'pending_facts',
]

/** Statuses that carry an explanatory note, so the UI asks for one. */
const STATUS_WANTS_NOTE: QuestionStatus[] = ['suspended', 'pending_facts']

/** Quiet secondary control, spec 4.4 "secondary is the idle pill style". */
const SECONDARY_PILL =
  'h-auto cursor-pointer rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-600 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-700 dark:hover:bg-stone-50'

const FIELD_LABEL =
  'text-[11px] font-semibold tracking-[0.12em] text-stone-400 uppercase'

const FIELD =
  'w-full rounded-lg border border-stone-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-stone-800 placeholder:text-stone-300 focus-visible:border-accent-600 focus-visible:ring-1 focus-visible:ring-accent-600'

/** Refetch `['topic', topicId]` and `['topics']` after every mutation. */
function useTopicInvalidation(topicId: string) {
  const queryClient = useQueryClient()
  return () => invalidateTopicQueries(queryClient, topicId)
}

/** Splits a textarea into one trimmed entry per line. */
function lines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/** Empty string means "clear the column"; the DAL patch takes `null` for that. */
function orNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

/* ------------------------------------------------------------------ round */

export function AddRoundDialog({ topicId }: { topicId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  const invalidate = useTopicInvalidation(topicId)

  const mutation = useMutation({
    mutationFn: (input: { topicId: string; title?: string }) =>
      createRoundFn({ data: input }),
    onSuccess: () => {
      void invalidate()
      setTitle('')
      setIsOpen(false)
    },
  })

  return (
    <>
      <Button
        variant="ghost"
        className={SECONDARY_PILL}
        onPress={() => setIsOpen(true)}
      >
        <PlusIcon />
        Add round
      </Button>

      <Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
        <DialogHeader>
          <DialogTitle>Add round</DialogTitle>
          <DialogDescription>
            Opens the next round on this topic. Questions are added to a round.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="round-title" className={FIELD_LABEL}>
            Title (optional)
          </Label>
          <Input
            id="round-title"
            className={FIELD}
            value={title}
            placeholder="What this round is about"
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
          <Button
            className={PRIMARY_BUTTON}
            isDisabled={mutation.isPending}
            onPress={() =>
              mutation.mutate({
                topicId,
                ...(title.trim() ? { title: title.trim() } : {}),
              })
            }
          >
            Create round
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}

/* --------------------------------------------------------------- questions */

interface QuestionRow {
  category: string
  text: string
  recommendation: string
  recommendedOption: string
  options: string
  note: string
}

function emptyRow(category: string): QuestionRow {
  return {
    category,
    text: '',
    recommendation: '',
    recommendedOption: '',
    options: '',
    note: '',
  }
}

export function AddQuestionsDialog({ topic }: { topic: TopicDetail }) {
  const lastRound = topic.rounds[topic.rounds.length - 1]
  const [isOpen, setIsOpen] = useState(false)
  const [roundId, setRoundId] = useState(lastRound?.id ?? '')
  const [rows, setRows] = useState<QuestionRow[]>([
    emptyRow(topic.categories[0] ?? ''),
  ])
  const invalidate = useTopicInvalidation(topic.id)

  const mutation = useMutation({
    mutationFn: (input: {
      topicId: string
      roundId: string
      items: NewQuestion[]
    }) => addQuestionsFn({ data: input }),
    onSuccess: () => {
      void invalidate()
      setRows([emptyRow(topic.categories[0] ?? '')])
      setIsOpen(false)
    },
  })

  const patchRow = (index: number, patch: Partial<QuestionRow>) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    )

  const items: NewQuestion[] = rows
    .filter((row) => row.text.trim() && row.category)
    .map((row) => {
      const options = lines(row.options)
      return {
        category: row.category,
        text: row.text.trim(),
        ...(row.recommendation.trim()
          ? { recommendation: row.recommendation.trim() }
          : {}),
        ...(options.length ? { options } : {}),
        ...(row.recommendedOption.trim()
          ? { recommendedOption: row.recommendedOption.trim() }
          : {}),
        ...(row.note.trim() ? { note: row.note.trim() } : {}),
      }
    })

  const canSubmit = Boolean(roundId) && items.length > 0 && !mutation.isPending

  return (
    <>
      <Button
        variant="ghost"
        className={SECONDARY_PILL}
        onPress={() => {
          setRoundId(lastRound?.id ?? '')
          setIsOpen(true)
        }}
        isDisabled={topic.rounds.length === 0}
      >
        <PlusIcon />
        Add questions
      </Button>

      <Dialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>Add questions</DialogTitle>
          <DialogDescription>
            Batch-add questions to a round. They start as open.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="round-target" className={FIELD_LABEL}>
            Round
          </Label>
          <Select
            aria-label="Round"
            className="w-full"
            selectedKey={roundId}
            onSelectionChange={(key) => setRoundId(String(key))}
          >
            <SelectTrigger id="round-target" className={FIELD}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {topic.rounds.map((round) => (
                  <SelectItem key={round.id} id={round.id}>
                    {round.title
                      ? `Round ${round.number} — ${round.title}`
                      : `Round ${round.number}`}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {rows.map((row, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-lg border border-stone-200 p-4"
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-stone-400">
                #{index + 1}
              </span>
              <span className="grow" />
              {rows.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove question ${index + 1}`}
                  onPress={() =>
                    setRows((current) => current.filter((_, i) => i !== index))
                  }
                >
                  <Trash2Icon />
                </Button>
              )}
            </div>

            <Select
              aria-label="Category"
              className="w-full"
              selectedKey={row.category}
              onSelectionChange={(key) =>
                patchRow(index, { category: String(key) })
              }
            >
              <SelectTrigger className={FIELD}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {topic.categories.map((category) => (
                    <SelectItem key={category} id={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Textarea
              aria-label="Question"
              rows={2}
              className={cn(FIELD, 'min-h-0 resize-y')}
              placeholder="Question"
              value={row.text}
              onChange={(event) => patchRow(index, { text: event.target.value })}
            />
            <Textarea
              aria-label="Recommendation"
              rows={2}
              className={cn(FIELD, 'min-h-0 resize-y')}
              placeholder="Recommendation (optional)"
              value={row.recommendation}
              onChange={(event) =>
                patchRow(index, { recommendation: event.target.value })
              }
            />
            <Textarea
              aria-label="Quick options"
              rows={2}
              className={cn(FIELD, 'min-h-0 resize-y')}
              placeholder="Quick options, one per line (optional)"
              value={row.options}
              onChange={(event) =>
                patchRow(index, { options: event.target.value })
              }
            />
            <Input
              aria-label="Recommended option"
              className={FIELD}
              placeholder="Recommended option — one of the lines above, verbatim (optional)"
              value={row.recommendedOption}
              onChange={(event) =>
                patchRow(index, { recommendedOption: event.target.value })
              }
            />
            <Input
              aria-label="Note"
              className={FIELD}
              placeholder="Note (optional)"
              value={row.note}
              onChange={(event) => patchRow(index, { note: event.target.value })}
            />
          </div>
        ))}

        <Button
          variant="ghost"
          className={cn(SECONDARY_PILL, 'justify-self-start')}
          onPress={() =>
            setRows((current) => [
              ...current,
              emptyRow(topic.categories[0] ?? ''),
            ])
          }
        >
          <PlusIcon />
          Another question
        </Button>

        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
          <Button
            className={PRIMARY_BUTTON}
            isDisabled={!canSubmit}
            onPress={() => mutation.mutate({ topicId: topic.id, roundId, items })}
          >
            Add {items.length || ''} {items.length === 1 ? 'question' : 'questions'}
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}

/* ---------------------------------------------------------- edit question */

export function EditQuestionDialog({
  topicId,
  question,
  categories,
  isOpen,
  onOpenChange,
}: {
  topicId: string
  question: Question
  categories: string[]
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [text, setText] = useState(question.text)
  const [category, setCategory] = useState(question.category)
  const [recommendation, setRecommendation] = useState(
    question.recommendation ?? '',
  )
  const [options, setOptions] = useState((question.options ?? []).join('\n'))
  const [recommendedOption, setRecommendedOption] = useState(
    question.recommendedOption ?? '',
  )
  const [note, setNote] = useState(question.note ?? '')
  const invalidate = useTopicInvalidation(topicId)

  const mutation = useMutation({
    mutationFn: (input: {
      topicId: string
      questionId: string
      text?: string
      category?: string
      recommendation?: string | null
      recommendedOption?: string | null
      options?: string[] | null
      note?: string | null
    }) => updateQuestionFn({ data: input }),
    onSuccess: () => {
      void invalidate()
      onOpenChange(false)
    },
  })

  const submit = () => {
    const parsedOptions = lines(options)
    mutation.mutate({
      topicId,
      questionId: question.id,
      text: text.trim(),
      category,
      recommendation: orNull(recommendation),
      options: parsedOptions.length ? parsedOptions : null,
      recommendedOption: orNull(recommendedOption),
      note: orNull(note),
    })
  }

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      className="max-h-[85vh] overflow-y-auto sm:max-w-lg"
    >
      <DialogHeader>
        <DialogTitle>Edit {question.id}</DialogTitle>
        <DialogDescription>
          Leave a field empty to clear it. Answers are not edited here.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <Label className={FIELD_LABEL}>Category</Label>
        <Select
          aria-label="Category"
          className="w-full"
          selectedKey={category}
          onSelectionChange={(key) => setCategory(String(key))}
        >
          <SelectTrigger className={FIELD}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {categories.map((item) => (
                <SelectItem key={item} id={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`edit-text-${question.id}`} className={FIELD_LABEL}>
          Question
        </Label>
        <Textarea
          id={`edit-text-${question.id}`}
          rows={3}
          className={cn(FIELD, 'min-h-0 resize-y')}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`edit-rec-${question.id}`} className={FIELD_LABEL}>
          Recommendation
        </Label>
        <Textarea
          id={`edit-rec-${question.id}`}
          rows={2}
          className={cn(FIELD, 'min-h-0 resize-y')}
          value={recommendation}
          onChange={(event) => setRecommendation(event.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`edit-options-${question.id}`} className={FIELD_LABEL}>
          Quick options (one per line)
        </Label>
        <Textarea
          id={`edit-options-${question.id}`}
          rows={2}
          className={cn(FIELD, 'min-h-0 resize-y')}
          value={options}
          onChange={(event) => setOptions(event.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`edit-rec-option-${question.id}`} className={FIELD_LABEL}>
          Recommended option
        </Label>
        <Input
          id={`edit-rec-option-${question.id}`}
          className={FIELD}
          placeholder="One of the options above, verbatim (optional)"
          value={recommendedOption}
          onChange={(event) => setRecommendedOption(event.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`edit-note-${question.id}`} className={FIELD_LABEL}>
          Note
        </Label>
        <Textarea
          id={`edit-note-${question.id}`}
          rows={2}
          className={cn(FIELD, 'min-h-0 resize-y')}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      <DialogFooter>
        <DialogClose>Cancel</DialogClose>
        <Button
          className={PRIMARY_BUTTON}
          isDisabled={!text.trim() || mutation.isPending}
          onPress={submit}
        >
          Save changes
        </Button>
      </DialogFooter>
    </Dialog>
  )
}

/* -------------------------------------------------------------- status menu */

export function QuestionStatusMenu({
  topicId,
  question,
  onEdit,
}: {
  topicId: string
  question: Question
  onEdit: () => void
}) {
  const [pending, setPending] = useState<QuestionStatus | null>(null)
  const [note, setNote] = useState('')
  const invalidate = useTopicInvalidation(topicId)

  const mutation = useMutation({
    mutationFn: (input: {
      topicId: string
      questionId: string
      status: QuestionStatus
      note?: string
    }) => setQuestionStatusFn({ data: input }),
    onSuccess: () => {
      void invalidate()
      setPending(null)
      setNote('')
    },
  })

  const move = (status: QuestionStatus) => {
    if (STATUS_WANTS_NOTE.includes(status)) {
      setNote(question.note ?? '')
      setPending(status)
      return
    }
    mutation.mutate({ topicId, questionId: question.id, status })
  }

  return (
    <>
      <DropdownMenuTrigger>
        <Button
          variant="ghost"
          size="icon-sm"
          className="cursor-pointer text-stone-400 hover:text-stone-700"
          aria-label={`Manage ${question.id}`}
        >
          <EllipsisIcon />
        </Button>
        <DropdownMenu placement="bottom end" className="w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem onAction={onEdit}>Edit question</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Move to</DropdownMenuLabel>
          <DropdownMenuGroup>
            {STATUS_ORDER.filter((status) => status !== question.status).map(
              (status) => (
                <DropdownMenuItem key={status} onAction={() => move(status)}>
                  {STATUS_META[status].label}
                </DropdownMenuItem>
              ),
            )}
          </DropdownMenuGroup>
        </DropdownMenu>
      </DropdownMenuTrigger>

      <Dialog
        isOpen={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null)
        }}
      >
        <DialogHeader>
          <DialogTitle>
            Move {question.id} to {pending ? STATUS_META[pending].label : ''}
          </DialogTitle>
          <DialogDescription>
            The note explains why, and stays visible on the card.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          aria-label="Note"
          rows={3}
          className={cn(FIELD, 'min-h-0 resize-y')}
          placeholder="Why is it parked? (optional)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />

        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
          <Button
            className={PRIMARY_BUTTON}
            isDisabled={mutation.isPending}
            onPress={() => {
              if (!pending) return
              mutation.mutate({
                topicId,
                questionId: question.id,
                status: pending,
                ...(note.trim() ? { note: note.trim() } : {}),
              })
            }}
          >
            Move question
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
