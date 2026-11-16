import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { planDay, type DeckPlan } from '../../db/queries'
import { masteryInfo } from '../../db/mastery'
import { Button, Ring, pct, readinessTone } from '../components'
import { Flag, IconCheck, IconChevron, IconFlame, IconPlay } from '../icons'
import { Illustration } from '../illustrations'
import { go } from '../router'
import { useSettings } from '../settings'
import { BackupReminder } from './SettingsScreen'
import { UpdateBanner } from '../UpdateCheck'
import { InstallCard } from '../install'

const dateFmt = new Intl.DateTimeFormat('de-CH', { weekday: 'long', day: 'numeric', month: 'long' })

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

export function Today() {
  const plan = useLiveQuery(() => planDay(db, new Date()), [])
  const mastery = useLiveQuery(() => masteryInfo(db), [])
  const settings = useSettings()
  const total = plan ? plan.reviews + plan.news + plan.cram : 0

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target
      if (e.key === 'Enter' && total > 0 && !(t instanceof HTMLInputElement) && !(t instanceof HTMLTextAreaElement) && !(t instanceof HTMLButtonElement) && !(t instanceof HTMLAnchorElement)) go('/lernen')
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [total])

  if (!plan) return <div className="h-40" aria-busy="true" />

  const exams = plan.decks.filter((d) => d.exam).sort((a, b) => a.exam!.days - b.exam!.days)
  const words = plan.decks.reduce((s, d) => s + d.total, 0)
  const next = exams[0]
  const doneToday = plan.reviewedToday
  const heroValue = next?.exam ? next.exam.readiness.overall ?? 0 : doneToday / Math.max(1, doneToday + total)
  const heroLabel = next?.exam ? 'bereit' : 'heute'
  const heroTone = next?.exam ? readinessTone(next.exam.readiness.overall) : 'accent'
  const sessions = Math.ceil(plan.minutes / settings.dailyMinutesGoal)

  return (
    <div className="space-y-7">
      <header>
        <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">{dateFmt.format(new Date())}</p>
        <h1 className="mt-0.5 text-[34px] font-bold leading-tight tracking-[-0.02em]">Heute</h1>
      </header>

      <UpdateBanner />

      {words === 0 ? (
        <section className="rounded-[26px] bg-surface px-6 py-12 text-center shadow-card">
          <div className="flex justify-center"><Illustration kind="cards" size={128} /></div>
          <p className="mt-5 text-[22px] font-bold tracking-tight">Noch keine Vokabeln</p>
          <p className="mx-auto mt-1.5 max-w-sm text-[15px] leading-relaxed text-muted">Fotografier deine Liste, lass Claude sie umwandeln und füg sie ein. Dauert etwa zwei Minuten.</p>
          <Button variant="primary" size="lg" className="mt-7" onClick={() => go('/import')}>Vokabeln importieren</Button>
        </section>
      ) : (
        <section className="rounded-[26px] bg-surface p-6 shadow-card desk:p-8">
          {total > 0 ? (
            <>
              <div className="flex items-center gap-5 desk:gap-7">
                <Ring value={heroValue} size={92} stroke={9} tone={heroTone} label={next?.exam ? `Prüfungsbereitschaft ${pct(next.exam.readiness.overall)}` : `Heute erledigt ${Math.round(heroValue * 100)} %`}>
                  <span className="leading-none">
                    <span className="block text-[22px] font-bold tabular tracking-tight">{Math.round(heroValue * 100)}%</span>
                    <span className="text-[11px] font-medium text-muted">{heroLabel}</span>
                  </span>
                </Ring>
                <div className="min-w-0">
                  <p className="text-[24px] font-bold leading-tight tracking-[-0.015em] desk:text-[28px]">
                    {[plan.news > 0 && plural(plan.news, 'neues Wort', 'neue Wörter'), plan.reviews + plan.cram > 0 && plural(plan.reviews + plan.cram, 'Wiederholung', 'Wiederholungen')].filter(Boolean).join(' · ')}
                  </p>
                  <p className="mt-1 text-[15px] text-muted tabular">
                    ca. {Math.max(1, plan.minutes)} Min{sessions > 1 ? ` · ${sessions} Sessions à ${settings.dailyMinutesGoal} Min` : ''}
                  </p>
                  {next?.exam && <p className="mt-1 text-[15px] text-muted">{next.deck.name}: Test {when(next.exam.days)}</p>}
                </div>
              </div>
              <Button variant="primary" size="lg" className="mt-6 w-full" onClick={() => go('/lernen')} kbd="Enter">
                <IconPlay /> Lernen starten
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-5">
              <Ring value={1} size={92} stroke={9} tone="good" label="Alles erledigt"><IconCheck width={30} height={30} className="text-good" /></Ring>
              <div>
                <p className="text-[24px] font-bold tracking-tight">Fertig für heute</p>
                <p className="mt-1 text-[15px] text-muted">Alles Fällige ist erledigt. Morgen geht’s weiter.</p>
              </div>
            </div>
          )}
          {plan.backlog && <p className="mt-5 rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">Über 150 Wiederholungen fällig: Neue Wörter pausieren, bis der Stau abgebaut ist (ausser bei Decks mit Testdatum).</p>}
        </section>
      )}

      {exams.length > 0 && (
        <section>
          <h2 className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">Tests</h2>
          <div className={exams.length > 1 ? 'grid gap-3 desk:grid-cols-2' : 'grid gap-3'}>
            {exams.map((p) => <ExamCard key={p.deck.id} p={p} />)}
          </div>
        </section>
      )}

      {mastery && words > 0 && (
        <section>
          <div className="mb-2.5 flex items-baseline justify-between px-1">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">Was sitzt?</h2>
            {mastery.counts.wackelt > 0 && <a href="#/ueben" className="text-[15px] font-medium text-accent">{mastery.counts.wackelt} wackeln</a>}
          </div>
          <ul className="overflow-hidden rounded-[22px] bg-surface shadow-card">
            {plan.decks.filter((d) => d.total > 0).map((d, i) => {
              const c = mastery.byDeck.get(d.deck.id)
              const all = c ? c.sitzt + c.lernt + c.wackelt + c.neu : 0
              const share = all ? (c!.sitzt / all) : 0
              return (
                <li key={d.deck.id}>
                  <a href={`#/deck/${d.deck.id}`} className="flex min-h-[68px] items-center gap-4 px-4 py-3 transition-colors duration-150 hover:bg-surface-2/60 desk:px-5">
                    <Ring value={share} size={40} stroke={5} tone="good" label={`${Math.round(share * 100)} % sitzt`} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-[17px] font-semibold"><Flag lang={d.deck.language} size={16} />{d.deck.name}</p>
                      <p className="text-[13px] text-muted tabular">{c?.sitzt ?? 0} sitzt · {c?.lernt ?? 0} lernt · {c?.wackelt ?? 0} wackelt · {c?.neu ?? 0} neu</p>
                    </div>
                    <IconChevron className="shrink-0 text-muted/60" />
                  </a>
                  {i < plan.decks.filter((x) => x.total > 0).length - 1 && <div className="ml-[72px] border-t border-line desk:ml-[76px]" />}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {words > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Serie" value={plural(plan.streak, 'Tag', 'Tage')} icon={<IconFlame width={16} height={16} className={plan.streak > 0 ? 'text-warn' : 'text-muted'} />} />
          <Stat label="Heute geübt" value={String(plan.reviewedToday)} />
          <Stat label="Wörter" value={String(words)} />
        </div>
      )}

      <InstallCard />
      <BackupReminder />
    </div>
  )
}

function when(days: number) {
  return days === 0 ? 'heute' : days === 1 ? 'morgen' : `in ${days} Tagen`
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-[18px] bg-surface px-4 py-3 shadow-card">
      <p className="text-[12px] font-medium text-muted">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-[19px] font-bold tabular tracking-tight">{icon}{value}</p>
    </div>
  )
}

function ExamCard({ p }: { p: DeckPlan }) {
  const e = p.exam!
  return (
    <a href={`#/deck/${p.deck.id}`} className="block rounded-[22px] bg-surface p-5 shadow-card transition-transform duration-150 active:scale-[0.99]">
      <div className="flex items-center gap-4">
        <Ring value={e.readiness.overall ?? 0} size={64} stroke={7} tone={readinessTone(e.readiness.overall)} label={`Prüfungsbereitschaft ${pct(e.readiness.overall)}`}>
          <span className="text-[15px] font-bold tabular">{Math.round((e.readiness.overall ?? 0) * 100)}%</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-[17px] font-semibold"><Flag lang={p.deck.language} size={16} />{p.deck.name}</p>
          <p className={`text-[15px] font-medium ${e.days <= 3 ? 'text-warn' : 'text-muted'}`}>Test {when(e.days)}</p>
          <p className="text-[13px] text-muted tabular">
            {e.readiness.toNative != null && <>Erkennen {pct(e.readiness.toNative)}</>}
            {e.readiness.toNative != null && e.readiness.toTarget != null && ' · '}
            {e.readiness.toTarget != null && <>Schreiben {pct(e.readiness.toTarget)}</>}
          </p>
        </div>
      </div>
      <p className="mt-4 border-t border-line pt-3 text-[13px]">
        {e.days <= 2 && p.unintroduced === 0 ? (
          <span className="text-muted">Nur noch Wiederholung, keine neuen Wörter.</span>
        ) : p.unintroduced === 0 ? (
          <span className="text-muted">Alle Wörter eingeführt.</span>
        ) : (
          <span><span className="font-semibold tabular">{e.perDay} neue Wörter/Tag</span><span className="text-muted"> · noch {p.unintroduced} nicht eingeführt</span></span>
        )}
      </p>
      {e.warning && (
        <p className="mt-2 rounded-xl bg-bad-soft px-3 py-2 text-[13px] text-bad">
          {e.days <= 2 ? 'Sehr knapp: Lern die restlichen Wörter heute, am besten in mehreren Sessions.' : 'Knapp! Mehr als 40 neue Wörter pro Tag. Mach heute 2 Sessions.'}
        </p>
      )}
    </a>
  )
}
