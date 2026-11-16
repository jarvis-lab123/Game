import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { streakInfo, type StreakInfo } from '../lib/streakstats'
import { cx } from './components'
import { IconFlame } from './icons'

const fmtDay = new Intl.DateTimeFormat('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })

async function loadStreak(): Promise<StreakInfo> {
  const ts = (await db.logs.orderBy('timestamp').keys()) as string[]
  return streakInfo(ts, new Date())
}

/** Learning streak: current run, record, this week (Mo–So) and active days of the last 30. */
export function StreakCard({ className }: { className?: string }) {
  const s = useLiveQuery(loadStreak, [])
  if (!s) return <div className={cx('h-[138px] rounded-[22px] bg-surface shadow-card', className)} aria-busy="true" />
  const on = s.current > 0
  return (
    <section className={cx('rounded-[22px] bg-surface p-5 shadow-card', className)} aria-label="Lernserie">
      <div className="flex items-center gap-3">
        <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-full', on ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-muted')}>
          <IconFlame width={24} height={24} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[22px] font-bold leading-tight tracking-tight tabular">
            {s.current} {s.current === 1 ? 'Tag' : 'Tage'} <span className="font-semibold">Serie</span>
          </p>
          <p className="truncate text-[13px] text-muted">{on ? (s.week.find((d) => d.today)?.active ? 'Heute schon geübt' : 'Üb heute, damit sie weiterläuft') : 'Üb heute und starte eine neue Serie'}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[12px] font-medium text-muted">Rekord</p>
          <p className="text-[17px] font-semibold tabular">{s.longest}</p>
        </div>
      </div>

      <ol className="mt-4 grid grid-cols-7 gap-1" aria-label="Diese Woche">
        {s.week.map((d) => {
          const [y, m, dd] = d.date.split('-').map(Number)
          const when = fmtDay.format(new Date(y, m - 1, dd))
          return (
            <li key={d.date} className="flex flex-col items-center gap-1.5" title={`${when}: ${d.active ? 'geübt' : 'nicht geübt'}`}>
              <span className={cx('text-[11px] font-medium', d.today ? 'text-fg' : 'text-muted')}>{d.label}</span>
              <span
                className={cx(
                  'h-6 w-6 rounded-full',
                  d.active ? 'bg-warn' : 'bg-surface-2',
                  d.today && 'ring-2 ring-warn ring-offset-2 ring-offset-surface',
                )}
              />
              <span className="sr-only">{`${when}: ${d.active ? 'geübt' : 'nicht geübt'}${d.today ? ' (heute)' : ''}`}</span>
            </li>
          )
        })}
      </ol>

      <p className="mt-3.5 text-[13px] text-muted">
        aktiv an <span className="font-medium text-fg tabular">{s.activeDays30}</span> der letzten 30 Tage
      </p>
    </section>
  )
}
