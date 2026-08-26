/**
 * Round Navigator (decision 5).
 *
 * A floating column of tick marks pinned to the left edge of the board and
 * centred vertically. One WIDE tick per round; one SHORT tick per question of
 * that round, in board order (`position`). Colour follows the question state.
 *
 * The component is self-contained: it only needs the rounds and questions, and
 * it finds its scroll targets in the DOM by data attribute.
 *
 *   Round section : <element data-round-id={round.id}>
 *   Question card : <element data-question-id={question.id}>
 *
 * The sections come from the same `groupByRound` the board uses, so every
 * section on screen has a tick here. Clicking a tick scrolls the matching
 * element into view. A rAF-throttled measurement of the same elements drives
 * the scroll-spy highlight. Hidden on mobile.
 */

import * as React from "react";
import { Button } from "react-aria-components";

import { useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { answeredCount, groupByRound, isSettled } from "@/lib/board";
import { cn } from "@/lib/utils";

import type { Question, QuestionStatus, Round } from "@/lib/types";

/** A tick in the column: either a round header or one of its questions. */
type Tick =
  | { kind: "round"; key: string; round: Round; questions: Question[] }
  | { kind: "question"; key: string; question: Question };

const STATUS_LABEL: Record<QuestionStatus, string> = {
  open: "Open",
  answered: "Answered",
  suspended: "Suspended",
  pending_facts: "Pending facts",
};

/**
 * Tick colour. A question holding a draft already counts as answered in every
 * progress readout, so it must not stand out as open here either.
 */
function tickColor(question: Question): string {
  if (question.status === "suspended" || question.status === "pending_facts") {
    return "bg-stone-300";
  }
  return isSettled(question) ? "bg-stone-400" : "bg-accent-600";
}

function buildTicks(rounds: Round[], questions: Question[]): Tick[] {
  const ticks: Tick[] = [];
  for (const section of groupByRound(questions, rounds)) {
    ticks.push({
      kind: "round",
      key: `r:${section.round.id}`,
      round: section.round,
      questions: section.questions,
    });
    for (const question of section.questions) {
      ticks.push({ kind: "question", key: `q:${question.id}`, question });
    }
  }
  return ticks;
}

function targetOf(tick: Tick): HTMLElement | null {
  const selector =
    tick.kind === "round"
      ? `[data-round-id="${CSS.escape(tick.round.id)}"]`
      : `[data-question-id="${CSS.escape(tick.question.id)}"]`;
  return document.querySelector<HTMLElement>(selector);
}

/**
 * Scroll-spy: the active tick is the LAST target whose top has already crossed
 * the reading line. The line is not fixed — it travels down the viewport with
 * the scroll progress: at the top of the document it sits at the viewport top,
 * at the end it sits at the viewport bottom.
 *
 * That single rule gives both ends for free, with no special case:
 *
 *   progress 0 -> the line is at y=0, nothing has crossed it, the first tick marks;
 *   progress 1 -> the line is at the viewport bottom, so every target on screen
 *                 has crossed it and the last tick marks.
 *
 * A fixed line cannot do the second case: the last sections of the page never
 * reach it, because the page stops scrolling while they are still below it.
 */
function readingLine(): number {
  const element = document.scrollingElement ?? document.documentElement;
  const max = element.scrollHeight - element.clientHeight;
  const progress = max > 0 ? Math.min(1, Math.max(0, element.scrollTop / max)) : 0;
  return progress * window.innerHeight;
}
function useActiveTick(ticks: Tick[], enabled: boolean): string | null {
  const [active, setActive] = React.useState<string | null>(null);
  const signature = ticks.map((tick) => tick.key).join("|");

  React.useEffect(() => {
    if (!enabled || ticks.length === 0) {
      setActive(null);
      return;
    }

    const measure = () => {
      const line = readingLine();
      let current: string | null = ticks[0]?.key ?? null;
      for (const tick of ticks) {
        const element = targetOf(tick);
        if (!element) continue;
        if (element.getBoundingClientRect().top <= line) current = tick.key;
        else break;
      }
      setActive(current);
    };

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };

    measure();
    // Capture on the document: the board can scroll in an inner container, and
    // scroll events do not bubble.
    document.addEventListener("scroll", schedule, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", schedule);
    // Sections grow and shrink (answers open, drafts save) without any scroll.
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(document.body);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      resizeObserver.disconnect();
    };
    // `signature` stands for the tick list; `ticks` itself is rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled]);

  return active;
}

/**
 * Preview card shown while a tick is hovered or focused. It stays dark in both
 * themes (decision 5), so its colours are literal instead of theme tokens.
 */
function TickPreview({ tick }: { tick: Tick }) {
  return (
    <div className="fade pointer-events-none absolute top-1/2 left-full z-50 ml-3 w-60 -translate-y-1/2 rounded-lg bg-[oklch(0.216_0.006_56.043)] px-3 py-2 text-left shadow-lg ring-1 ring-black/10">
      {tick.kind === "round" ? (
        <>
          <p className="text-xs font-semibold text-[oklch(0.97_0.001_106.424)]">
            {tick.round.kind === "confirmation"
              ? `Confirmação — Round ${tick.round.number}`
              : tick.round.title
                ? `Round ${tick.round.number} — ${tick.round.title}`
                : `Round ${tick.round.number}`}
          </p>
          <p className="mt-1 text-[11px] text-[oklch(0.71_0.006_56)]">
            {answeredCount(tick.questions)}/{tick.questions.length} answered
          </p>
        </>
      ) : (
        <>
          <p className="line-clamp-3 text-xs text-[oklch(0.97_0.001_106.424)]">
            {tick.question.text}
          </p>
          <p className="mt-1 text-[11px] text-[oklch(0.71_0.006_56)]">
            {tick.question.category} · {STATUS_LABEL[tick.question.status]}
          </p>
        </>
      )}
    </div>
  );
}

export function RoundNavigator({
  rounds,
  questions,
  className,
}: {
  rounds: Round[];
  questions: Question[];
  className?: string;
}) {
  const isMobile = useIsMobile();
  const { state } = useSidebar();
  const ticks = React.useMemo(() => buildTicks(rounds, questions), [rounds, questions]);
  const active = useActiveTick(ticks, !isMobile);
  const [hovered, setHovered] = React.useState<string | null>(null);

  if (isMobile || ticks.length === 0) return null;

  const scrollTo = (tick: Tick) => {
    targetOf(tick)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // The sidebar is `variant="inset" collapsible="offcanvas"`. The content card
  // (SidebarInset) starts at `--sidebar-width` while the sidebar is expanded
  // (`ml-0`), and at `0.5rem` once it is collapsed (`ml-2`, sidebar gap 0).
  // Keep the same 1.5rem gutter inside the card in both states, so the column
  // always sits on the card surface, never on the sidebar.
  return (
    <nav
      aria-label="Rounds and questions"
      className={cn(
        "fixed top-1/2 z-40 hidden max-h-[70svh] -translate-y-1/2 flex-col gap-1 overflow-y-auto overscroll-contain transition-[left] duration-200 ease-linear [scrollbar-width:none] md:flex",
        className,
      )}
      style={{
        left:
          state === "expanded" ? "calc(var(--sidebar-width) + 1.5rem)" : "calc(0.5rem + 1.5rem)",
      }}
    >
      {ticks.map((tick) => {
        const isRound = tick.kind === "round";
        const isActive = active === tick.key;
        const isHovered = hovered === tick.key;
        // A confirmation round keeps the accent even at rest (decision 6):
        // the gate must be findable in the column at a glance.
        const color = isRound
          ? tick.round.kind === "confirmation"
            ? isActive
              ? "bg-accent-700"
              : "bg-accent-600"
            : isActive
              ? "bg-stone-900"
              : "bg-stone-400"
          : tickColor(tick.question);
        const label = isRound
          ? tick.round.kind === "confirmation"
            ? `Confirmação — Round ${tick.round.number}`
            : `Round ${tick.round.number}`
          : tick.question.text;

        return (
          <div
            key={tick.key}
            className={cn("relative flex items-center", isRound && "mt-3 first:mt-0")}
          >
            <Button
              aria-label={label}
              className={cn(
                "fade group flex h-3 cursor-pointer items-center outline-none",
                isRound ? "w-8" : "w-4",
              )}
              onHoverStart={() => setHovered(tick.key)}
              onHoverEnd={() => setHovered((key) => (key === tick.key ? null : key))}
              onFocus={() => setHovered(tick.key)}
              onBlur={() => setHovered((key) => (key === tick.key ? null : key))}
              onPress={() => scrollTo(tick)}
            >
              <span
                className={cn(
                  "fade block w-full rounded-full",
                  isRound ? "h-[3px]" : "h-[2px]",
                  color,
                  isActive || isHovered ? "opacity-100" : "opacity-70",
                  // A question tick also grows when active: on the muted
                  // colours opacity alone reads as no change at all.
                  !isRound && isActive && "scale-x-125",
                  isHovered && "scale-x-110",
                )}
              />
            </Button>
            {isHovered ? <TickPreview tick={tick} /> : null}
          </div>
        );
      })}
    </nav>
  );
}
