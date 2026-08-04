import { Fragment, useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

import type { CSSProperties, ReactNode } from 'react'

/**
 * Marks itself `data-inked` the first time it scrolls into view, then stops
 * observing. Descendant `.stamp` and `.rise` elements transition off that
 * attribute (styles.css), each honoring its own `--ink-d` delay.
 */
export function Ink({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      el.dataset.inked = ''
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          el.dataset.inked = ''
          io.disconnect()
        }
      },
      { threshold: 0.12 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

interface StampProps {
  children: ReactNode
  blood?: boolean
  /** Resting rotation in degrees. */
  r?: number
  /** Ink-in delay in ms, for staggering stamps inside one `Ink`. */
  d?: number
  className?: string
}

export function Stamp({ children, blood, r = -4, d = 0, className }: StampProps) {
  return (
    <span
      className={cn('stamp', blood && 'stamp-blood', className)}
      style={{ '--stamp-r': `${r}deg`, '--ink-d': `${d}ms` } as CSSProperties}
    >
      {children}
    </span>
  )
}

/** A strip of adhesive tape. Position it with `className`. */
export function Tape({ className, r = -40 }: { className?: string; r?: number }) {
  return (
    <span
      aria-hidden
      className={cn('tape', className)}
      style={{ '--tape-r': `${r}deg` } as CSSProperties}
    />
  )
}

interface WordsProps {
  text: string
  /** Delay of the first word in ms. */
  from?: number
  /** Delay between words in ms. */
  step?: number
  className?: string
}

/** Splits `text` into per-word mask-reveals for the hero load animation. */
export function Words({ text, from = 0, step = 70, className }: WordsProps) {
  return (
    <>
      {text.split(' ').map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          {i > 0 && ' '}
          <span className="wmask">
            <span
              className={cn('w', className)}
              style={{ '--w-d': `${from + i * step}ms` } as CSSProperties}
            >
              {word}
            </span>
          </span>
        </Fragment>
      ))}
    </>
  )
}
