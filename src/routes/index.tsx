import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: WelcomePage });

function WelcomePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 pt-24 pb-40">
      <span className="text-[11px] font-semibold tracking-[0.16em] text-stone-400 uppercase">
        Grill Board
      </span>
      <h1 className="mt-2 text-xl leading-snug font-semibold tracking-tight text-stone-900 sm:text-2xl">
        Pick a topic to open its board.
      </h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-500">
        A topic is one interrogation: rounds of questions grouped by category, each with the
        agent&rsquo;s recommendation and your answer. Choose one in the sidebar, or start a new one.
      </p>

      <div className="mt-12 border-t border-stone-100 pt-6">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-stone-400 uppercase">
          For agents
        </p>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-500">
          Register this board as an MCP server and an agent can create topics, fire rounds of
          questions and read your answers back.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-stone-50 px-4 py-3 font-mono text-xs leading-relaxed text-stone-600 ring-1 ring-stone-200/70">
          <code>claude mcp add --transport http grill-board http://localhost:3000/mcp</code>
        </pre>
      </div>
    </div>
  );
}
