/**
 * Minimal markdown renderer for the confirmation-round synthesis.
 *
 * The synthesis is agent-written and follows a known shape: headings, short
 * paragraphs, bullet/numbered lists, bold, inline code, code fences. That is
 * the whole grammar here — no HTML pass-through, no external dependency, and
 * everything is emitted as React elements, so nothing is ever injected raw.
 */

import * as React from 'react'

type Block =
  | { type: 'heading'; depth: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'code'; text: string }

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (line.trim() === '') {
      index += 1
      continue
    }

    if (line.startsWith('```')) {
      const body: string[] = []
      index += 1
      while (index < lines.length && !lines[index].startsWith('```')) {
        body.push(lines[index])
        index += 1
      }
      index += 1 // closing fence (or end of input)
      blocks.push({ type: 'code', text: body.join('\n') })
      continue
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push({ type: 'heading', depth: heading[1].length, text: heading[2] })
      index += 1
      continue
    }

    const bullet = /^\s*[-*]\s+/.test(line)
    const numbered = /^\s*\d+[.)]\s+/.test(line)
    if (bullet || numbered) {
      const items: string[] = []
      const marker = bullet ? /^\s*[-*]\s+/ : /^\s*\d+[.)]\s+/
      while (index < lines.length && marker.test(lines[index])) {
        items.push(lines[index].replace(marker, ''))
        index += 1
      }
      blocks.push({ type: 'list', ordered: numbered, items })
      continue
    }

    const paragraph: string[] = [line]
    index += 1
    while (
      index < lines.length &&
      lines[index].trim() !== '' &&
      !lines[index].startsWith('```') &&
      !/^(#{1,4})\s/.test(lines[index]) &&
      !/^\s*[-*]\s+/.test(lines[index]) &&
      !/^\s*\d+[.)]\s+/.test(lines[index])
    ) {
      paragraph.push(lines[index])
      index += 1
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
  }

  return blocks
}

/** Inline pass: `code`, **bold**, *italic* — in that precedence. */
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, at) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={at}
          className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[0.85em] text-stone-700"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={at} className="font-semibold text-stone-900">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={at}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

export function Markdown({ source }: { source: string }) {
  const blocks = React.useMemo(() => parseBlocks(source), [source])

  return (
    <div className="min-w-0 space-y-3 text-sm leading-relaxed break-words text-stone-700">
      {blocks.map((block, at) => {
        switch (block.type) {
          case 'heading':
            return (
              <p
                key={at}
                className={
                  block.depth <= 2
                    ? 'pt-2 text-[13px] font-semibold tracking-wide text-stone-900 first:pt-0'
                    : 'pt-1 text-[11px] font-semibold tracking-[0.12em] text-stone-500 uppercase first:pt-0'
                }
              >
                {renderInline(block.text)}
              </p>
            )
          case 'list':
            return block.ordered ? (
              <ol key={at} className="list-decimal space-y-1 pl-5 marker:text-stone-400">
                {block.items.map((item, itemAt) => (
                  <li key={itemAt}>{renderInline(item)}</li>
                ))}
              </ol>
            ) : (
              <ul key={at} className="list-disc space-y-1 pl-5 marker:text-stone-400">
                {block.items.map((item, itemAt) => (
                  <li key={itemAt}>{renderInline(item)}</li>
                ))}
              </ul>
            )
          case 'code':
            return (
              <pre
                key={at}
                className="overflow-x-auto rounded-lg bg-stone-100 p-3 font-mono text-xs text-stone-700"
              >
                {block.text}
              </pre>
            )
          default:
            return <p key={at}>{renderInline(block.text)}</p>
        }
      })}
    </div>
  )
}
