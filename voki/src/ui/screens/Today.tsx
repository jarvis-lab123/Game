import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { planDay, type DeckPlan } from '../../db/queries'
import { Badge, Button, Empty, Panel, Progress, SectionTitle, pct } from '../components'
import { Flag, IconCheck, IconFlame, IconPlay } from '../icons'
import { go } from '../router'
import { useSettings } from '../settings'
import { BackupReminder } from './SettingsScreen'

const dateFmt = new Intl.DateTimeFormat('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

export function Today() {
  const plan = useLiveQuery(() => planDay(db, new Date()), [])
  const settings = useSettings()
  const total = plan ? plan.reviews + plan.news + plan.cram : 0

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && total > 0 && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLAnchorElement)) go('/lernen')
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [total])

  if (!plan) return <div className="h-40" aria-busy="true" />

  const exams = plan.decks.filter((d) => d.exam).sort((a, b) => a.exam!.days - b.exam!.days)
  const hasDecks = plan.decks.length > 0
  const words = plan.decks.reduce((s, d) => s + d.total, 0)

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium capitalize text-muted">{dateFmt.format(new Date())}</p>
        <h1 className="mt-0.5 text-[28px] font-semibold tracking-tight">Heute</h1>
      </header>

      {!hasDecks || words === 0 ? (
        <Empty
          title="Noch keine Vokabeln"
          action={<Button variant="primary" onClick={() => go('/import')}>Vokabeln importieren</Button>}
        >
          Importier deine erste Liste. Mit dem Foto-Prompt für Claude dauert das etwa zwei Minuten.
        </Empty>
      ) : (
        <Panel className="p-6 desk:p-8">
          {total > 0 ? (
            <>
              <p className="text-[15px] text-muted">Deine Aufgabe für heute</p>
              <p className="mt-1 text-[22px] font-semibold leading-snug tracking-tight desk:text-[26px]">
                {[
                  plan.reviews > 0 && plural(plan.reviews, 'Wiederholung', 'Wiederholungen'),
                  plan.news > 0 && plural(plan.news, 'neues Wort', 'neue Wörter'),
                  plan.cram > 0 && `${plan.cram} Extra vor dem Test`,
                ]
                  .filter(Boolean)
                  .join(' + ')}
              </p>
              <p className="mt-1 text-[15px] text-muted tabular">
                ca. {Math.max(1, plan.minutes)} Min
                {plan.minutes > settings.dailyMinutesGoal * 1.3
                  ? ` · ${Math.ceil(plan.minutes / settings.dailyMinutesGoal)} Sessions à ${settings.dailyMinutesGoal} Min`
                  : ` · Ziel ${settings.dailyMinutesGoal} Min`}
              </p>
              <Button variant="primary" size="lg" className="mt-6 w-full desk:w-auto desk:min-w-64" onClick={() => go('/lernen')} kbd="Enter">
                <IconPlay /> Session starten
              </Button>
            </>
          ) : (
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-good-soft text-good"><IconCheck /></span>
              <div>
                <p className="text-[20px] font-semibold tracking-tight">Fertig für heute</p>
                <p className="mt-1 text-[15px] text-muted">Alles Fällige ist erledigt. Morgen geht’s weiter, so bleibt es im Langzeitgedächtnis.</p>
              </div>
            </div>
          )}
          {plan.backlog && (
            <p className="mt-5 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">
              Über 150 Wiederholungen fällig: Neue Wörter pausieren, bis der Stau abgebaut ist (ausser bei Decks mit Testdatum).
            </p>
          )}
        </Panel>
      )}

      {exams.length > 0 && (
        <section>
          <SectionTitle>Tests</SectionTitle>
          <div className="grid gap-3 desk:grid-cols-2">
            {exams.map((p) => <ExamCard key={p.deck.id} p={p} />)}
          </div>
        </section>
      )}

      {hasDecks && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Serie" value={plural(plan.streak, 'Tag', 'Tage')} icon={<IconFlame width={16} height={16} className={plan.streak > 0 ? 'text-warn' : 'text-muted'} />} />
          <Stat label="Heute geübt" value={String(plan.reviewedToday)} />
          <Stat label="Wörter" value={String(words)} />
        </div>
      )}

      <BackupReminder />
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-3 ring-1 ring-line">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-[17px] font-semibold tabular">{icon}{value}</p>
    </div>
  )
}

function readinessTone(v: number | null) {
  if (v == null) return 'accent' as const
  return v >= 0.8 ? ('good' as const) : v >= 0.5 ? ('warn' as const) : ('bad' as const)
}

function ExamCard({ p }: { p: DeckPlan }) {
  const e = p.exam!
  const when = e.days === 0 ? 'heute' : e.days === 1 ? 'morgen' : `in ${e.days} Tagen`
  return (
    <a href={`#/deck/${p.deck.id}`} className="block rounded-2xl bg-surface p-5 ring-1 ring-line transition-colors duration-150 hover:ring-accent/40">
      <div className="flex items-center gap-2.5">
        <Flag lang={p.deck.language} />
        <p className="min-w-0 flex-1 truncate font-semibold">{p.deck.name}</p>
        <Badge tone={e.days <= 3 ? 'warn' : 'neutral'}>Test {when}</Badge>
      </div>
      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-sm text-muted">Prüfungsbereitschaft</span>
        <span className="text-[22px] font-semibold tabular">{pct(e.readiness.overall)}</span>
      </div>
      <Progress className="mt-2" value={e.readiness.overall ?? 0} tone={readinessTone(e.readiness.overall)} label="Prüfungsbereitschaft" />
      <p className="mt-2 text-sm text-muted tabular">
        {e.readiness.toNative != null && <>Erkennen {pct(e.readiness.toNative)}</>}
        {e.readiness.toNative != null && e.readiness.toTarget != null && ' · '}
        {e.readiness.toTarget != null && <>Schreiben {pct(e.readiness.toTarget)}</>}
      </p>
      <p className="mt-3 border-t border-line pt-3 text-sm">
        {e.days <= 2 && p.unintroduced === 0 ? (
          <span className="text-muted">Nur noch Wiederholung, keine neuen Wörter.</span>
        ) : p.unintroduced === 0 ? (
          <span className="text-muted">Alle Wörter eingeführt.</span>
        ) : (
          <span>
            <span className="font-medium tabular">{e.perDay} neue Wörter/Tag</span>
            <span className="text-muted"> · noch {p.unintroduced} nicht eingeführt</span>
          </span>
        )}
      </p>
      {e.warning && (
        <p className="mt-2 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {e.days <= 2 ? 'Sehr knapp: Lern die restlichen Wörter heute, am besten in 2 Sessions.' : 'Knapp! Mehr als 40 neue Wörter pro Tag. Mach heute 2 Sessions.'}
        </p>
      )}
    </a>
  )
}
