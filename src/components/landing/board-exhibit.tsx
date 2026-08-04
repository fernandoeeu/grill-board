import { T } from '@/components/landing/lang'
import { Stamp, Tape } from '@/components/landing/zine'

import type { CSSProperties, ReactNode } from 'react'

/**
 * The board, re-created in the page's own ink — no screenshots, no bitmaps.
 * Content is the real grill that produced this page, trimmed to two cards.
 */
export function BoardExhibit() {
  return (
    <div
      className="cutout relative mx-auto w-full max-w-2xl p-5 text-ink sm:p-7"
      style={{ '--cut-r': '-1.2deg', '--cut-r2': '-0.6deg' } as CSSProperties}
    >
      <Tape className="-top-3 -left-8" r={-38} />
      <Tape className="-top-3 -right-8" r={42} />

      {/* Topic header */}
      <header className="border-b-2 border-ink pb-4">
        <p className="font-mono text-[11px] font-bold tracking-[0.18em] uppercase opacity-60">
          <T en="Topic under interrogation" pt="Topic sob interrogatório" />
        </p>
        <h3 className="font-display mt-1 text-2xl leading-none uppercase sm:text-3xl">
          landing-page-visceral
        </h3>
        <div className="mt-3 flex items-center gap-3 font-mono text-xs font-bold">
          <span>
            <T en="ROUND 3 OF 4" pt="ROUND 3 DE 4" />
          </span>
          <span className="h-2 flex-1 bg-ink/10">
            <span className="block h-full w-[77%] bg-blood" />
          </span>
          <span>
            <T en="17/22 ANSWERED" pt="17/22 RESPONDIDAS" />
          </span>
        </div>
      </header>

      {/* Answered card */}
      <ExhibitCard
        rotate="0.4deg"
        category={<T en="ART DIRECTION" pt="DIREÇÃO DE ARTE" />}
        question={<T en="What look does this page get?" pt="Que cara esta página tem?" />}
        recommendation={
          <T
            en="Punk zine — photocopy, stamps, tape. No barbecue clichés."
            pt="Zine punk — xerox, carimbos, fita. Sem clichê de churrasco."
          />
        }
        stamp={
          <Stamp r={8} d={120} className="text-sm">
            <T en="ANSWERED" pt="RESPONDIDA" />
          </Stamp>
        }
      >
        <p className="mt-3 font-mono text-sm leading-relaxed font-bold">
          <span className="mr-2 opacity-60">
            <T en="YOU —" pt="VOCÊ —" />
          </span>
          <span className="bg-ink px-1.5 py-0.5 text-bone">
            <T
              en="Approved. It's an interrogation, not a barbecue."
              pt="Aprovado. É um interrogatório, não um churrasco."
            />
          </span>
        </p>
      </ExhibitCard>

      {/* Open card */}
      <ExhibitCard
        rotate="-0.5deg"
        category={<T en="MOTION" pt="MOVIMENTO" />}
        question={
          <T
            en="How much movement can this page have?"
            pt="Quanto movimento esta página pode ter?"
          />
        }
        recommendation={
          <T
            en="Reveal on scroll, stamps that slam in, nothing past 300 ms."
            pt="Revelação no scroll, carimbos que batem, nada acima de 300 ms."
          />
        }
        stamp={
          <Stamp blood r={6} d={200} className="text-sm">
            <T en="OPEN" pt="ABERTA" />
          </Stamp>
        }
      >
        <div className="mt-3 flex flex-wrap gap-2 font-mono text-xs font-bold uppercase">
          <span className="border-2 border-ink px-2 py-1">
            <T en="None" pt="Nada" />
          </span>
          <span className="border-2 border-ink px-2 py-1">
            <T en="Subtle" pt="Sutil" />
          </span>
          <span className="border-2 border-blood px-2 py-1 text-blood">
            <T en="Full zine" pt="Zine total" />
          </span>
        </div>
      </ExhibitCard>

      <p className="mt-5 font-mono text-[11px] leading-relaxed tracking-wide uppercase opacity-60">
        <T
          en="Exhibit A is real: the grill that produced this page ran 4 rounds, 22 questions. Re-created in ink — no screenshots."
          pt="A Prova A é real: o grill que produziu esta página rodou 4 rounds, 22 perguntas. Recriado a tinta — sem screenshots."
        />
      </p>
    </div>
  )
}

interface ExhibitCardProps {
  rotate: string
  category: ReactNode
  question: ReactNode
  recommendation: ReactNode
  stamp: ReactNode
  children: ReactNode
}

function ExhibitCard({
  rotate,
  category,
  question,
  recommendation,
  stamp,
  children,
}: ExhibitCardProps) {
  return (
    <article
      className="relative mt-5 border-2 border-ink p-4"
      style={{ rotate }}
    >
      <div className="absolute -top-3.5 -right-2">{stamp}</div>
      <p className="font-mono text-[10px] font-bold tracking-[0.2em] uppercase opacity-60">
        {category}
      </p>
      <h4 className="mt-1.5 pr-24 font-mono text-base leading-snug font-bold sm:text-lg">
        {question}
      </h4>
      <p className="mt-3 border-l-4 border-blood pl-3 font-mono text-sm leading-relaxed">
        <span className="font-bold text-blood">
          <T en="AGENT RECOMMENDS — " pt="O AGENTE RECOMENDA — " />
        </span>
        {recommendation}
      </p>
      {children}
    </article>
  )
}
