/**
 * Round filter chips (spec 4.4). "All rounds" is the default; the active chip
 * is black. Filtering never changes the header progress — it only narrows the
 * cards on screen.
 */

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { Round } from '@/lib/types'

/** Chip geometry from spec 4.4; the `dark:` entries neutralise the ghost variant. */
const CHIP =
  'h-auto cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium'
const CHIP_ACTIVE =
  'border-stone-900 bg-stone-900 text-white hover:bg-stone-900 hover:text-white dark:hover:bg-stone-900'
const CHIP_IDLE =
  'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-600 dark:hover:bg-stone-50'

export function RoundFilter({
  rounds,
  active,
  onChange,
}: {
  rounds: Round[]
  active: number | null
  onChange: (round: number | null) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        className={cn(CHIP, active === null ? CHIP_ACTIVE : CHIP_IDLE)}
        onPress={() => onChange(null)}
      >
        All rounds
      </Button>
      {rounds.map((round) => (
        <Button
          key={round.id}
          variant="ghost"
          className={cn(
            CHIP,
            active === round.number ? CHIP_ACTIVE : CHIP_IDLE,
          )}
          onPress={() => onChange(round.number)}
        >
          {round.title
            ? `Round ${round.number} — ${round.title}`
            : `Round ${round.number}`}
        </Button>
      ))}
    </div>
  )
}
