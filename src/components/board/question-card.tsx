/**
 * One question card (spec 4.4).
 *
 * Child order is fixed: meta row -> question text -> recommendation ->
 * recorded answer -> note -> answer form. The recommendation and the recorded
 * answer render on any status that carries them, not only on open questions.
 */

import { useState } from "react";

import { AnswerForm } from "@/components/board/answer-form";
import {
  EditQuestionDialog,
  QuestionStatusMenu,
  STATUS_META,
} from "@/components/board/manage-dialogs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { Question } from "@/lib/types";

const PANEL_LABEL = "text-[11px] font-semibold tracking-[0.12em] uppercase";

export function QuestionCard({
  topicId,
  question,
  categories,
}: {
  topicId: string;
  question: Question;
  /** The topic's declared categories, offered when the question is edited. */
  categories?: string[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const status = STATUS_META[question.status];

  return (
    <article
      id={question.id}
      data-question-id={question.id}
      className={cn(
        "min-w-0 scroll-mt-48 rounded-xl bg-white p-6 ring-1 sm:p-7",
        question.status === "open" ? "ring-stone-200" : "ring-stone-100",
        question.status === "suspended" && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-xs text-stone-400">{question.id}</span>
        <span className="text-xs text-stone-300">·</span>
        {/* The board groups by round, so the card labels the category instead. */}
        <span className="min-w-0 text-[11px] font-semibold tracking-[0.12em] text-stone-500 break-words uppercase">
          {question.category}
        </span>
        <span className="grow" />
        <Badge
          variant="secondary"
          className={cn("h-auto rounded-full px-2.5 py-0.5 text-xs font-medium", status.badge)}
        >
          {status.label}
        </Badge>
        <QuestionStatusMenu
          topicId={topicId}
          question={question}
          onEdit={() => setIsEditing(true)}
        />
      </div>

      <p className="mt-4 text-[17px] leading-relaxed font-medium break-words text-stone-900">
        {question.text}
      </p>

      {question.recommendation && (
        <div className="mt-5 rounded-lg border-l-2 border-accent-200 bg-accent-50/60 px-4 py-3">
          <div className={cn(PANEL_LABEL, "text-accent-700")}>Recommendation</div>
          <p className="mt-1 text-sm leading-relaxed break-words text-stone-600">
            {question.recommendation}
          </p>
        </div>
      )}

      {question.answer && (
        <div className="mt-5 rounded-lg bg-stone-50 px-4 py-3 ring-1 ring-stone-200/70">
          <div className={cn(PANEL_LABEL, "flex items-center gap-2 text-stone-500")}>
            Recorded answer
            {question.answeredVia === "chat" && (
              <span className="text-xs font-normal text-stone-400">· answered in chat</span>
            )}
          </div>
          <p className="mt-1 text-sm leading-relaxed break-words text-stone-700">
            {question.answer}
          </p>
        </div>
      )}

      {question.note && (
        <p className="mt-4 text-sm leading-relaxed break-words text-stone-400 italic">
          {question.note}
        </p>
      )}

      {/* The form owns its own divider (spec 4.4), so it needs no wrapper. */}
      {question.status === "open" && <AnswerForm topicId={topicId} question={question} />}

      {isEditing && (
        <EditQuestionDialog
          topicId={topicId}
          question={question}
          categories={categories ?? [question.category]}
          isOpen={isEditing}
          onOpenChange={setIsEditing}
        />
      )}
    </article>
  );
}
