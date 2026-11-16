import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { masteryInfo } from '../../db/mastery'
import type { Deck, Note } from '../../lib/types'
import { classifyError, ERROR_INFO, type ErrorKind } from '../../lib/errors'
import { normalize } from '../../lib/grade'
import { copyText } from '../../platform'
import { Badge, Button, Empty, PageHeader, Panel, SectionTitle, Segmented, TextArea, cx } from '../components'
import { Flag, IconCheck, IconChevron, IconCopy, IconFlame, IconPlay } from '../icons'
import { Illustration } from '../illustrations'
import { MnemonicStudio } from '../MnemonicStudio'
import { go } from '../router'

type Tab = 'fehlerheft' | 'probetest' | 'werkstatt'

export function Practice({ tab: initial }: { tab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initial ?? 'fehlerheft')
  return (
    <div>
      <PageHeader title="Üben" subtitle="Schwache Wörter gezielt stärken und den Test proben." />
      <div className="mb-5">
        <Segmented label="Bereich" value={tab} onChange={setTab} options={[{ value: 'fehlerheft', label: 'Fehlerheft' }, { value: 'probetest', label: 'Probetest' }, { value: 'werkstatt', label: 'Eselsbrücken' }]} />
      </div>
      {tab === 'fehlerheft' ? <Fehlerheft /> : tab === 'probetest' ? <ProbeTestHome /> : <Werkstatt />}
    </div>
  )
}

/* ---------------- Fehlerheft ---------------- */
interface Entry { note: Note; deck: Deck; kinds: Set<ErrorKind>; wrongTyped?: string; leech: boolean; wobbly: boolean; overconfident: boolean }

function useFehlerheft() {
  return useLiveQuery(async () => {
    const decks = new Map((await db.decks.filter((d) => !d.archived).toArray()).map((d) => [d.id, d]))
    const { byNote } = await masteryInfo(db)
    const cards = (await db.cards.toArray()).filter((c) => decks.has(c.deckId) && !c.suspended)
    const cardById = new Map(cards.map((c) => [c.id, c]))
    const notes = new Map((await db.notes.toArray()).map((n) => [n.id, n]))
    const since = new Date(Date.now() - 14 * 86400000).toISOString()
    const wrong = (await db.logs.where('timestamp').aboveOrEqual(since).toArray()).filter((l) => !l.correct && l.mode !== 'intro')
    const entries = new Map<string, Entry>()
    const get = (noteId: string): Entry | null => {
      const note = notes.get(noteId)
      const deck = note && decks.get(note.deckId)
      if (!note || !deck) return null
      let e = entries.get(noteId)
      if (!e) {
        e = { note, deck, kinds: new Set(), leech: false, wobbly: byNote.get(noteId) === 'wackelt', overconfident: note.tags.includes('überschätzt') }
        entries.set(noteId, e)
      }
      return e
    }
    for (const l of wrong) {
      const c = cardById.get(l.cardId)
      if (!c) continue
      const e = get(c.noteId)
      if (!e) continue
      const toTarget = c.direction === 'toTarget'
      const lang = toTarget ? (e.deck.language === 'other' ? 'other' : e.deck.language) : 'de'
      e.kinds.add(classifyError(l.typedAnswer, toTarget ? e.note.term : e.note.translation, lang))
      if (l.typedAnswer && !e.wrongTyped) e.wrongTyped = l.typedAnswer
    }
    for (const c of cards) if (c.leech) { const e = get(c.noteId); if (e) e.leech = true }
    for (const [id, m] of byNote) if (m === 'wackelt') get(id)
    for (const n of notes.values()) if (n.tags.includes('überschätzt')) get(n.id)
    return [...entries.values()]
  }, [])
}

function Fehlerheft() {
  const entries = useFehlerheft()
  if (!entries) return <div className="h-40" aria-busy="true" />
  if (entries.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
        <div className="flex justify-center"><Illustration kind="notebook" size={96} /></div>
        <p className="mt-3 text-[17px] font-semibold">Dein Fehlerheft ist leer</p>
        <p className="mx-auto mt-1 max-w-sm text-[15px] text-muted">Hier landen Wörter, die wackeln, die du falsch hattest oder bei denen du dich im Probetest überschätzt hast.</p>
      </div>
    )
  const groups: { key: string; title: string; tip: string; items: Entry[]; icon?: React.ReactNode }[] = [
    { key: 'leech', title: 'Problemwörter', tip: 'Schon 4-mal vergessen. Hier hilft nur eine starke Eselsbrücke.', items: entries.filter((e) => e.leech), icon: <IconFlame width={16} height={16} className="text-warn" /> },
    ...(['nichtGewusst', 'genus', 'flüchtig'] as ErrorKind[]).map((k) => ({ key: k, title: ERROR_INFO[k].title, tip: ERROR_INFO[k].tip, items: entries.filter((e) => e.kinds.has(k)) })),
    { key: 'over', title: 'Überschätzt', tip: 'Im Probetest „sicher“, aber falsch. Genau diese Wörter fühlen sich bekannt an und sind es nicht.', items: entries.filter((e) => e.overconfident) },
    { key: 'wobbly', title: 'Wackelt', tip: 'Die Erinnerung lässt nach. Kurz auffrischen, bevor es weg ist.', items: entries.filter((e) => e.wobbly && !e.leech && e.kinds.size === 0 && !e.overconfident) },
  ].filter((g) => g.items.length > 0)

  return (
    <div className="space-y-5">
      <Panel className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[22px] font-semibold tabular">{entries.length} {entries.length === 1 ? 'Wort' : 'Wörter'}</p>
          <p className="text-sm text-muted">Drill: erst auswählen, dann schreiben. Zählt nicht für den Wiederholungsplan.</p>
        </div>
        <Button variant="primary" size="lg" onClick={() => go(`/lernen?go=1&drill=1&min=10&mode=type&t=${Date.now()}`)}><IconPlay /> Fehlerheft üben</Button>
      </Panel>
      {groups.map((g) => (
        <section key={g.key}>
          <SectionTitle>
            <span className="inline-flex items-center gap-1.5">{g.icon}{g.title} · {g.items.length}</span>
          </SectionTitle>
          <p className="-mt-1 mb-3 text-sm text-muted">{g.tip}</p>
          <ul className="divide-y divide-line overflow-hidden rounded-[22px] bg-surface shadow-card">
            {g.items.slice(0, 30).map((e) => (
              <li key={e.note.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                <span className="w-7 shrink-0 text-center text-[20px]">{e.note.emoji ?? <Flag lang={e.deck.language} size={16} />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium" lang={e.deck.language}>{e.note.term}</span>
                  <span className="block truncate text-sm text-muted">{e.note.translation}{e.wrongTyped && g.key !== 'over' && g.key !== 'leech' ? <> · du: <span className="line-through">{e.wrongTyped}</span></> : null}</span>
                </span>
                {e.note.mnemonic ? <Badge tone="good">Eselsbrücke</Badge> : <Badge>ohne Brücke</Badge>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/* ---------------- Probetest ---------------- */
function ProbeTestHome() {
  const decks = useLiveQuery(() => db.decks.filter((d) => !d.archived).toArray(), [])
  const tests = useLiveQuery(() => db.tests.orderBy('date').reverse().limit(10).toArray(), [])
  const [size, setSize] = useState<'20' | '40' | 'all'>('20')
  const [mode, setMode] = useState<'end' | 'live'>('end')
  if (!decks) return <div className="h-40" aria-busy="true" />
  if (decks.length === 0) return <Empty title="Noch kein Deck" action={<Button variant="primary" onClick={() => go('/import')}>Vokabeln importieren</Button>} />
  const query = `&n=${size}${mode === 'live' ? '&live=1' : ''}`
  return (
    <div className="space-y-5">
      <Panel className="flex items-center gap-5">
        <Illustration kind="test" size={88} />
        <div className="min-w-0">
          <p className="text-[17px] font-semibold">Generalprobe wie im echten Voki</p>
          <p className="mt-1 text-sm text-muted">Zufällige Wörter, nur Tippen, keine Hilfe. Vor jeder Antwort sagst du, wie sicher du bist. Note nach Schweizer Skala.</p>
          <p className="mt-2 text-sm font-medium">Ein Buchstabe falsch = kein Punkt · Akzente zählen</p>
          <p className="text-sm text-muted">Auf Deutsch zählt die Bedeutung.</p>
        </div>
      </Panel>
      <div className="flex flex-col gap-4 rounded-[22px] bg-surface p-5 shadow-card desk:flex-row desk:flex-wrap desk:items-center desk:gap-x-8">
        <div className="flex flex-col gap-1.5 desk:flex-row desk:items-center desk:gap-3">
          <span className="text-sm font-medium text-muted">Umfang</span>
          <div className="self-start"><Segmented label="Umfang des Probetests" value={size} onChange={setSize} options={[{ value: '20', label: '20' }, { value: '40', label: '40' }, { value: 'all', label: 'Alle' }]} /></div>
        </div>
        <div className="flex flex-col gap-1.5 desk:flex-row desk:items-center desk:gap-3">
          <span className="text-sm font-medium text-muted">Note</span>
          <div className="self-start"><Segmented label="Auswertung" value={mode} onChange={setMode} options={[{ value: 'end', label: 'Am Schluss' }, { value: 'live', label: 'Sofort auswerten' }]} /></div>
        </div>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-[22px] bg-surface shadow-card">
        {decks.map((d) => (
          <li key={d.id}>
            <a href={`#/probetest?deck=${d.id}${query}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-surface-2 desk:px-5">
              <Flag lang={d.language} />
              <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
              <span className="text-sm font-medium text-accent">Probetest starten</span>
              <IconChevron className="text-muted" />
            </a>
          </li>
        ))}
      </ul>
      {tests && tests.length > 0 && (
        <section>
          <SectionTitle>Bisherige Probetests</SectionTitle>
          <ul className="divide-y divide-line overflow-hidden rounded-[22px] bg-surface shadow-card">
            {tests.map((t) => {
              const d = decks.find((x) => x.id === t.deckId)
              const over = t.items.filter((i) => i.confident && !i.correct).length
              return (
                <li key={t.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5 desk:px-5">
                  <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[15px] font-bold tabular', t.grade >= 5 ? 'bg-good-soft text-good' : t.grade >= 4 ? 'bg-warn-soft text-warn' : 'bg-bad-soft text-bad')}>{t.grade.toFixed(1)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{d?.name ?? 'Gelöschtes Deck'}</span>
                    <span className="block text-sm text-muted tabular">{new Date(t.date).toLocaleDateString('de-CH')} · {t.correct}/{t.total} richtig{over ? ` · ${over} überschätzt` : ''}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

/* ---------------- Eselsbrücken-Werkstatt ---------------- */
const CLAUDE_MNEMONIC_PROMPT = (lines: string) => `Ich lerne diese Vokabeln (Schüler, Gymnasium). Erfinde zu jedem Wort eine kurze, bildhafte Eselsbrücke auf Deutsch (max. 15 Wörter), gern lustig oder mit Klangähnlichkeit.
Antworte NUR als TSV, eine Zeile pro Wort: Wort<TAB>Eselsbrücke. Keine Kopfzeile, kein Kommentar.

${lines}`

function Werkstatt() {
  const data = useLiveQuery(async () => {
    const decks = new Map((await db.decks.filter((d) => !d.archived).toArray()).map((d) => [d.id, d]))
    const { byNote } = await masteryInfo(db)
    const notes = (await db.notes.toArray()).filter((n) => decks.has(n.deckId))
    const todo = notes.filter((n) => !n.mnemonic && !n.emoji && !n.sketch && ['wackelt', 'lernt'].includes(byNote.get(n.id) ?? ''))
    const order = { wackelt: 0, lernt: 1 } as Record<string, number>
    todo.sort((a, b) => (order[byNote.get(a.id) ?? ''] ?? 2) - (order[byNote.get(b.id) ?? ''] ?? 2))
    return { decks, todo: todo.slice(0, 40), all: notes, byNote }
  }, [])
  const [open, setOpen] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [paste, setPaste] = useState('')
  const [msg, setMsg] = useState('')
  const lines = useMemo(() => (data ? data.todo.slice(0, 25).map((n) => `${n.term}\t${n.translation}`).join('\n') : ''), [data])
  if (!data) return <div className="h-40" aria-busy="true" />

  const importBack = async () => {
    const byTerm = new Map(data.all.map((n) => [normalize(n.term), n]))
    let count = 0
    for (const line of paste.split(/\r?\n/)) {
      const [term, ...rest] = line.split('\t')
      const text = rest.join(' ').trim()
      const n = term && byTerm.get(normalize(term))
      if (n && text) {
        await db.notes.put({ ...n, mnemonic: text, updatedAt: new Date().toISOString() })
        count++
      }
    }
    setMsg(count ? `${count} Eselsbrücken gespeichert.` : 'Keine passenden Zeilen gefunden. Format: Wort⇥Eselsbrücke.')
    if (count) setPaste('')
  }

  return (
    <div className="space-y-5">
      <Panel>
        <p className="text-[17px] font-semibold">Eselsbrücken mit Claude</p>
        <p className="mt-1 text-sm text-muted">Kopier den Prompt mit deinen wackligen Wörtern, schick ihn Claude, und füg die Antwort unten ein. Am besten wirken aber die Brücken, die du selbst anpasst.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={!lines} onClick={async () => { if (await copyText(CLAUDE_MNEMONIC_PROMPT(lines))) { setCopied(true); setTimeout(() => setCopied(false), 2000) } }}>
            {copied ? <><IconCheck width={18} height={18} className="text-good" /> Kopiert</> : <><IconCopy width={18} height={18} /> Prompt kopieren ({Math.min(25, data.todo.length)} Wörter)</>}
          </Button>
        </div>
        <TextArea className="mt-4 font-mono text-[14px]" rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'la boulangerie\tIn der BOULangerie gibt es Bulle-Brötchen'} aria-label="Antwort von Claude einfügen" />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button variant="primary" disabled={!paste.trim()} onClick={importBack}>Eselsbrücken übernehmen</Button>
          {msg && <span role="status" className="text-sm text-muted">{msg}</span>}
        </div>
      </Panel>
      <section>
        <SectionTitle>Noch ohne Eselsbrücke · {data.todo.length}</SectionTitle>
        {data.todo.length === 0 ? (
          <Empty title="Alles verankert">Alle wackligen und neuen Wörter haben schon eine Eselsbrücke.</Empty>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[22px] bg-surface shadow-card">
            {data.todo.map((n) => {
              const d = data.decks.get(n.deckId)!
              return (
                <li key={n.id}>
                  <button className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2" aria-expanded={open === n.id} onClick={() => setOpen(open === n.id ? null : n.id)}>
                    <Flag lang={d.language} size={16} />
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{n.term}</span><span className="block truncate text-sm text-muted">{n.translation}</span></span>
                    <Badge tone={data.byNote.get(n.id) === 'wackelt' ? 'warn' : 'accent'}>{data.byNote.get(n.id)}</Badge>
                  </button>
                  {open === n.id && <div className="border-t border-line bg-bg/50 px-4 py-4"><MnemonicStudio note={n} language={d.language} /></div>}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
