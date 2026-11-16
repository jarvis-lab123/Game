import type { Mastery } from '../lib/mastery'
import { cx } from './components'

export const MASTERY_ORDER: Mastery[] = ['sitzt', 'lernt', 'wackelt', 'neu']
export const MASTERY_TONE: Record<Mastery, { bar: string; dot: string; badge: 'good' | 'accent' | 'warn' | 'neutral' }> = {
  sitzt: { bar: 'bg-good', dot: 'bg-good', badge: 'good' },
  lernt: { bar: 'bg-accent', dot: 'bg-accent', badge: 'accent' },
  wackelt: { bar: 'bg-warn', dot: 'bg-warn', badge: 'warn' },
  neu: { bar: 'bg-surface-2', dot: 'bg-line', badge: 'neutral' },
}

/** Stacked "sitzt / lernt / wackelt / neu" bar with a legend. */
export function MasteryBar({ counts, compact }: { counts: Record<Mastery, number>; compact?: boolean }) {
  const total = MASTERY_ORDER.reduce((s, k) => s + counts[k], 0)
  const label = MASTERY_ORDER.map((k) => `${counts[k]} ${k}`).join(', ')
  return (
    <div>
      <div className={cx('flex w-full overflow-hidden rounded-full bg-surface-2', compact ? 'h-1.5' : 'h-2.5')} role="img" aria-label={`Wörter: ${label}`}>
        {total > 0 && MASTERY_ORDER.map((k) => counts[k] > 0 && <div key={k} className={cx('h-full transition-[width] duration-300', MASTERY_TONE[k].bar)} style={{ width: `${(counts[k] / total) * 100}%` }} />)}
      </div>
      {!compact && (
        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {MASTERY_ORDER.map((k) => (
            <li key={k} className="flex items-center gap-1.5 text-muted">
              <span className={cx('h-2 w-2 rounded-full', MASTERY_TONE[k].dot)} />
              <span className="font-medium tabular text-fg">{counts[k]}</span> {k}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
