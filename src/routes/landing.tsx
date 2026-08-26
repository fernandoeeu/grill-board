import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "react-aria-components";

import { BoardExhibit } from "@/components/landing/board-exhibit";
import { LANG_SCRIPT, LangToggle, T, useStoredLang } from "@/components/landing/lang";
import { Ink, Stamp, Tape, Words } from "@/components/landing/zine";

import { cn } from "@/lib/utils";

const MCP_COMMAND = "claude mcp add --transport http grill-board http://localhost:3000/mcp";

export const Route = createFileRoute("/landing")({
  head: () => ({
    meta: [
      { title: "Grill Board — Ideas go in. Specs come out." },
      {
        name: "description",
        content:
          "A local board where your agent interrogates you, round after round, until an idea becomes a spec.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Black+Ops+One&display=swap",
      },
    ],
    scripts: [{ children: LANG_SCRIPT }],
  }),
  component: LandingPage,
});

function LandingPage() {
  useStoredLang();

  return (
    <div className="landing min-h-svh overflow-x-clip font-mono">
      <div aria-hidden className="landing-grain" />

      <Hero />
      <Interrogation />
      <Evidence />
      <Doctrine />
      <Verdict />
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Scene 1 — hero manifesto + the one CTA                                    */
/* ------------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="relative flex min-h-svh flex-col px-5 sm:px-10">
      <header className="flex items-center justify-between pt-5">
        <span className="font-display text-lg tracking-wide uppercase">Grill Board</span>
        <LangToggle />
      </header>

      <Ink className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center py-16">
        <p>
          <Stamp blood r={-3} className="text-sm sm:text-base">
            <T en="Interrogation room nº 3000" pt="Sala de interrogatório nº 3000" />
          </Stamp>
        </p>

        <h1 className="font-display mt-6 text-[clamp(2.6rem,9vw,7rem)] leading-[0.98] uppercase">
          <T
            className="block"
            en={
              <>
                <span className="block">
                  <Words text="Ideas go" step={80} />{" "}
                  <span className="wmask">
                    <span className="w" style={{ "--w-d": "160ms" } as CSSProperties}>
                      in<span className="text-blood">.</span>
                    </span>
                  </span>
                </span>
                <span className="mt-3 block" style={{ rotate: "-1deg" }}>
                  <Words
                    text="Specs come out."
                    from={260}
                    step={80}
                    className="bg-ink px-[0.14em] text-bone"
                  />
                </span>
              </>
            }
            pt={
              <>
                <span className="block">
                  <Words text="A ideia" step={80} />{" "}
                  <span className="wmask">
                    <span className="w" style={{ "--w-d": "160ms" } as CSSProperties}>
                      entra<span className="text-blood">.</span>
                    </span>
                  </span>
                </span>
                <span className="mt-3 block" style={{ rotate: "-1deg" }}>
                  <Words
                    text="O spec sai."
                    from={260}
                    step={80}
                    className="bg-ink px-[0.14em] text-bone"
                  />
                </span>
              </>
            }
          />
        </h1>

        <p className="mt-8 max-w-2xl text-base leading-relaxed font-bold sm:text-lg">
          <T
            en={
              <>
                Your agent interrogates you until <span className="mark-blood">nothing</span> is
                left assumed.
              </>
            }
            pt={
              <>
                Seu agente te interroga até não sobrar <span className="mark-blood">nada</span>{" "}
                assumido.
              </>
            }
          />
        </p>

        <CommandBlock className="mt-12" />

        <div className="mt-14 flex items-end justify-between gap-6">
          <p className="text-xs font-bold tracking-[0.2em] uppercase opacity-60">
            <T en="↓ The interrogation" pt="↓ O interrogatório" />
          </p>
          <div aria-hidden className="hidden text-right sm:block">
            <div className="barcode w-36 opacity-80" />
            <p className="mt-1 text-[10px] tracking-[0.3em] uppercase opacity-60">grl·brd·3000</p>
          </div>
        </div>
      </Ink>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Scene 2 — how a grill works                                               */
/* ------------------------------------------------------------------------ */

const STEPS = [
  {
    n: "01",
    en: {
      title: "You bring an idea.",
      body: "Half-formed is fine. The grill exists because it's half-formed.",
    },
    pt: {
      title: "Você traz uma ideia.",
      body: "Pode vir pela metade. O grill existe porque ela está pela metade.",
    },
  },
  {
    n: "02",
    en: {
      title: "The agent opens a topic.",
      body: "It digs through code and docs first — then fires a round of questions it cannot answer alone.",
    },
    pt: {
      title: "O agente abre um topic.",
      body: "Primeiro ele vasculha código e docs — depois dispara um round de perguntas que não consegue responder sozinho.",
    },
  },
  {
    n: "03",
    en: {
      title: "You answer on the board.",
      body: "At your own pace. Every answer settles prerequisites and unlocks the next round of questions: the frontier.",
    },
    pt: {
      title: "Você responde no board.",
      body: "No seu ritmo. Cada resposta assenta pré-requisitos e destrava o próximo round de perguntas: a frontier.",
    },
  },
  {
    n: "04",
    en: {
      title: "The frontier runs dry.",
      body: "No question left to ask, nothing left silently assumed. Out comes a spec — and the tickets to build it.",
    },
    pt: {
      title: "A frontier seca.",
      body: "Nenhuma pergunta restante, nada assumido em silêncio. Sai um spec — e os tickets para construí-lo.",
    },
  },
];

function Interrogation() {
  return (
    <section className="relative border-y-4 border-ink px-5 py-20 sm:px-10">
      <Ink className="mx-auto w-full max-w-5xl">
        <h2 className="font-display text-[clamp(2.2rem,6vw,4.5rem)] leading-none uppercase">
          <T en="The interrogation" pt="O interrogatório" />
        </h2>
        <div aria-hidden className="halftone mt-4 h-6 w-2/3 opacity-25" />

        <ol className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2">
          {STEPS.map((step, i) => (
            <li key={step.n} className="rise" style={{ "--ink-d": `${i * 70}ms` } as CSSProperties}>
              <div className="flex items-baseline gap-4">
                <span className="font-display text-5xl text-blood sm:text-6xl">{step.n}</span>
                <h3 className="text-lg font-bold uppercase sm:text-xl">
                  <T en={step.en.title} pt={step.pt.title} />
                </h3>
              </div>
              <p className="mt-3 max-w-md text-sm leading-relaxed sm:pl-[4.5rem]">
                <T en={step.en.body} pt={step.pt.body} />
              </p>
            </li>
          ))}
        </ol>

        <div
          className="cutout relative mx-auto mt-16 max-w-xl p-5"
          style={{ "--cut-r": "1deg", "--cut-r2": "1.6deg" } as CSSProperties}
        >
          <Tape className="-top-3 left-10" r={-42} />
          <p className="text-sm leading-relaxed">
            <T
              en={
                <>
                  <strong className="text-blood">FRONTIER, n.</strong> — the questions whose
                  prerequisites are already settled. The grill is done when the frontier is empty.
                </>
              }
              pt={
                <>
                  <strong className="text-blood">FRONTIER, s.</strong> — as perguntas cujos
                  pré-requisitos já estão assentados. O grill acaba quando a frontier esvazia.
                </>
              }
            />
          </p>
        </div>
      </Ink>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Scene 3 — the board, re-created in ink under a hard light                 */
/* ------------------------------------------------------------------------ */

function Evidence() {
  return (
    <section className="relative bg-ink px-5 py-24 text-bone sm:px-10">
      <div aria-hidden className="spotlight pointer-events-none absolute inset-0" />
      <Ink className="relative mx-auto w-full max-w-5xl">
        <p>
          <Stamp blood r={-5} className="text-sm sm:text-base">
            <T en="Exhibit A" pt="Prova A" />
          </Stamp>
        </p>
        <h2 className="font-display mt-5 text-[clamp(2.2rem,6vw,4.5rem)] leading-none uppercase">
          <T en="The board" pt="O board" />
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-relaxed font-bold sm:text-base">
          <T
            en="Rounds of questions, pinned like evidence. The recommendation is the agent's. The verdict is yours."
            pt="Rounds de perguntas, fixados como provas. A recomendação é do agente. O veredito é seu."
          />
        </p>

        <div className="mt-14">
          <BoardExhibit />
        </div>
      </Ink>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Scene 4 — the doctrine                                                    */
/* ------------------------------------------------------------------------ */

function Doctrine() {
  return (
    <section className="relative px-5 py-24 sm:px-10">
      <Ink className="mx-auto w-full max-w-5xl">
        <div className="rise">
          <h2 className="font-display max-w-4xl text-[clamp(1.9rem,5.5vw,4rem)] leading-tight uppercase">
            <T
              en={
                <>
                  Facts are the agent&rsquo;s job.{" "}
                  <span className="bg-ink px-[0.14em] text-bone">
                    Decisions are yours<span className="text-blood">.</span>
                  </span>
                </>
              }
              pt={
                <>
                  Fatos são trabalho do agente.{" "}
                  <span className="bg-ink px-[0.14em] text-bone">
                    Decisões são suas<span className="text-blood">.</span>
                  </span>
                </>
              }
            />
          </h2>
        </div>

        <div className="mt-12 grid max-w-4xl gap-10 sm:grid-cols-2">
          <p
            className="rise text-sm leading-relaxed"
            style={{ "--ink-d": "80ms" } as CSSProperties}
          >
            <T
              en="It reads the code. It searches the docs. It never asks what it can look up — only what only you can decide: trade-offs, taste, risk."
              pt="Ele lê o código. Ele busca nos docs. Nunca pergunta o que pode descobrir — só o que só você pode decidir: trade-offs, gosto, risco."
            />
          </p>
          <div
            className="cutout rise relative p-5"
            style={
              {
                "--ink-d": "160ms",
                "--cut-r": "-1deg",
                "--cut-r2": "-0.4deg",
              } as CSSProperties
            }
          >
            <Tape className="-top-3 right-8" r={38} />
            <p className="text-sm leading-relaxed font-bold uppercase">
              <T
                en={
                  <>
                    A grill doesn&rsquo;t judge a plan. It interrogates an{" "}
                    <span className="text-blood">idea</span> until it becomes shared understanding.
                  </>
                }
                pt={
                  <>
                    Um grill não julga um plano. Ele interroga uma{" "}
                    <span className="text-blood">ideia</span> até ela virar entendimento
                    compartilhado.
                  </>
                }
              />
            </p>
          </div>
        </div>
      </Ink>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* Scene 5 — the verdict, stamped                                            */
/* ------------------------------------------------------------------------ */

function Verdict() {
  return (
    <section className="relative bg-ink px-5 py-24 text-bone sm:px-10">
      <Ink className="mx-auto flex w-full max-w-5xl flex-col items-start">
        <p>
          <Stamp blood r={-6} className="text-lg sm:text-2xl">
            <T en="Verdict" pt="Veredito" />
          </Stamp>
        </p>
        <h2 className="font-display mt-6 text-[clamp(2.4rem,7vw,5.5rem)] leading-none uppercase">
          <T en="Nothing left assumed." pt="Nada ficou assumido." />
        </h2>
        <p className="mt-5 max-w-xl text-sm leading-relaxed font-bold sm:text-base">
          <T
            en="Spec out. Tickets out. Get back to building."
            pt="Spec na mão. Tickets na fila. Volte a construir."
          />
        </p>

        <CommandBlock flavor="bone" className="mt-12 w-full" />

        <footer className="mt-20 w-full border-t-2 border-bone/20 pt-5 text-[11px] tracking-[0.2em] uppercase opacity-60">
          <T
            en="Grill Board — printed at localhost:3000 · runs local · no cloud, no signup"
            pt="Grill Board — impresso em localhost:3000 · roda local · sem nuvem, sem cadastro"
          />
        </footer>
      </Ink>
    </section>
  );
}

/* ------------------------------------------------------------------------ */
/* The one CTA: the install command                                          */
/* ------------------------------------------------------------------------ */

function CommandBlock({
  flavor = "ink",
  className,
}: {
  flavor?: "ink" | "bone";
  className?: string;
}) {
  const onInk = flavor === "bone";

  return (
    <div className={cn("max-w-3xl", className)}>
      <p>
        <Stamp blood={!onInk} r={-2} d={80} className="text-xs sm:text-sm">
          <T en="Wire your agent — the only CTA" pt="Plugue seu agente — o único CTA" />
        </Stamp>
      </p>
      <div
        className={cn(
          "relative mt-3 flex flex-wrap items-center gap-4 p-5 sm:p-6",
          onInk ? "cutout text-ink" : "bg-ink text-bone shadow-[6px_6px_0_0_var(--color-blood)]",
        )}
        style={onInk ? ({ "--cut-r": "-0.6deg", "--cut-r2": "0deg" } as CSSProperties) : undefined}
      >
        <Tape className="-top-3 right-12" r={34} />
        <code className="min-w-0 flex-1 text-sm leading-relaxed font-bold break-all sm:text-base">
          <span aria-hidden className="mr-2 text-blood">
            $
          </span>
          {MCP_COMMAND}
        </code>
        <CopyButton onInk={onInk} />
      </div>
      <p className="mt-2 text-[11px] font-bold tracking-[0.18em] uppercase opacity-60">
        <T en="One command. Your agent does the rest." pt="Um comando. Seu agente faz o resto." />
      </p>
    </div>
  );
}

function CopyButton({ onInk }: { onInk: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <Button
      className={cn(
        "press shrink-0 cursor-pointer border-2 px-3 py-2 text-xs font-bold tracking-[0.14em] uppercase",
        onInk ? "border-ink text-ink" : "border-bone text-bone",
        copied && "border-blood text-blood",
      )}
      onPress={() => {
        navigator.clipboard
          .writeText(MCP_COMMAND)
          .then(() => {
            setCopied(true);
            if (timer.current !== null) window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setCopied(false), 1800);
          })
          .catch(() => {
            // Clipboard blocked: the command is right there to select.
          });
      }}
    >
      {copied ? <T en="Copied!" pt="Copiado!" /> : <T en="Copy" pt="Copiar" />}
    </Button>
  );
}
