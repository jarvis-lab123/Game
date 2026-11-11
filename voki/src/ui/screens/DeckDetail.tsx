import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { planDay } from '../../db/queries'
import { deleteDeck, deleteNote, syncDirections } from '../../db/repo'
import type { Card, Deck, Note } from '../../lib/types'
import { normalize } from '../../lib/grade'
import { needsWarning, newPerDay } from '../../lib/exam'
import { Badge, Button, Empty, Input, Label, PageHeader, Panel, Progress, SectionTitle, Segmented, Toggle, pct } from '../components'
import { Flag, IconBack, IconPlay, IconSearch, IconTrash, IconImport } from '../icons'
import { go } from '../router'
import { DirectionPicker } from './Decks'

const STAGE_LABEL: Record<Card['stage'], string> = { new: 'neu', intro: 'neu', mc: 'lernt', type: 'lernt', review: 'gelernt' }

export function DeckDetail({ id }: { id: string }) {
  const deck = useLiveQuery(() => db.decks.get(id), [id])
  const plan = useLiveQuery(() => planDay(db, new Date(), id), [id])
  const notes = useLiveQuery(() => db.notes.where('deckId').equals(id).toArray(), [id])
  const cards = useLiveQuery(() => db.cards.where('deckId').equals(id).toArray(), [id])
  const [tab, setTab] = useState<'words' | 'settings'>('words')
  if (deck === undefined || !plan) return <div className="h-40" aria-busy="true" />
  if (deck === null || !deck) return <Empty title="Deck nicht gefunden" action={<Button onClick={() => go('/decks')}>Zu den Decks</Button>} />
  const p = plan.decks[0]
  const todo = p ? p.due + p.newToday + p.cram.length : 0

  return (
    <div>
      <PageHeader
        back={<a href="#/decks" className="-ml-2 mb-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-muted hover:text-fg"><IconBack width={16} height={16} /> Decks</a>}
        title={deck.name}
        subtitle={<span className="inline-flex items-center gap-2"><Flag lang={deck.language} /> {p?.total ?? 0} Wörter · {p?.due ?? 0} fällig · {p?.unintroduced ?? 0} neu</span>}
        action={
          <div className="flex gap-2">
            <Button onClick={() => go(`/import?deck=${deck.id}`)}><IconImport /> Import</Button>
            <Button variant="primary" disabled={todo === 0} onClick={() => go(`/lernen?deck=${deck.id}`)}><IconPlay /> Lernen{todo > 0 && ` (${todo})`}</Button>
          </div>
        }
      />

      {p?.exam && (
        <Panel className="mb-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold">Prüfungsmodus · Test {p.exam.days === 0 ? 'heute' : p.exam.days === 1 ? 'morgen' : `in ${p.exam.days} Tagen`}</p>
            <p className="text-[22px] font-semibold tabular">{pct(p.exam.readiness.overall)} bereit</p>
          </div>
          <Progress className="mt-3" value={p.exam.readiness.overall ?? 0} tone={(p.exam.readiness.overall ?? 0) >= 0.8 ? 'good' : (p.exam.readiness.overall ?? 0) >= 0.5 ? 'warn' : 'bad'} label="Prüfungsbereitschaft" />
          <p className="mt-2 text-sm text-muted tabular">Erkennen {pct(p.exam.readiness.toNative)} · Schreiben {pct(p.exam.readiness.toTarget)} · {p.exam.days <= 2 ? 'nur Wiederholung' : `${p.exam.perDay} neue/Tag`}</p>
        </Panel>
      )}

      <div className="mb-4">
        <Segmented label="Ansicht" value={tab} onChange={setTab} options={[{ value: 'words', label: 'Wörter' }, { value: 'settings', label: 'Einstellungen' }]} />
      </div>
      {tab === 'words' ? <WordList deck={deck} notes={notes ?? []} cards={cards ?? []} /> : <DeckSettings deck={deck} unintroduced={p?.unintroduced ?? 0} />}
    </div>
  )
}

function WordList({ deck, notes, cards }: { deck: Deck; notes: Note[]; cards: Card[] }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [limit, setLimit] = useState(50)
  const byNote = useMemo(() => {
    const m = new Map<string, Card[]>()
    for (const c of cards) m.set(c.noteId, [...(m.get(c.noteId) ?? []), c])
    return m
  }, [cards])
  const order = useMemo(() => new Map(cards.map((c) => [c.noteId, c.order])), [cards])
  const list = notes
    .filter((n) => !q || normalize(`${n.term} ${n.translation}`).includes(normalize(q)))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))

  if (notes.length === 0)
    return <Empty title="Noch keine Wörter" action={<Button variant="primary" onClick={() => go(`/import?deck=${deck.id}`)}>Wörter importieren</Button>}>Füge Vokabeln per Einfügen, Datei oder Foto-Prompt hinzu.</Empty>

  return (
    <div>
      <div className="relative mb-3">
        <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" width={18} height={18} />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`${notes.length} Wörter durchsuchen`} aria-label="Wörter durchsuchen" className="pl-10" />
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
        {list.slice(0, limit).map((n) => {
          const cs = byNote.get(n.id) ?? []
          const suspended = cs.length > 0 && cs.every((c) => c.suspended)
          const stage = cs.some((c) => c.stage === 'review') ? (cs.every((c) => c.stage === 'review') ? 'review' : 'mc') : cs[0]?.stage ?? 'new'
          return (
            <li key={n.id}>
              <button onClick={() => setOpen(open === n.id ? null : n.id)} aria-expanded={open === n.id} className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2 desk:px-5">
                <span className={`min-w-0 flex-1 ${suspended ? 'opacity-50' : ''}`}>
                  <span className="block truncate font-medium" lang={deck.language}>{n.term}</span>
                  <span className="block truncate text-sm text-muted">{n.translation}</span>
                </span>
                {cs.some((c) => c.leech) && <Badge tone="warn">Problemwort</Badge>}
                {suspended ? <Badge>gesperrt</Badge> : <Badge tone={stage === 'review' ? 'good' : stage === 'new' ? 'neutral' : 'accent'}>{STAGE_LABEL[stage]}</Badge>}
              </button>
              {open === n.id && <NoteEditor note={n} cards={cs} onClose={() => setOpen(null)} />}
            </li>
          )
        })}
        {list.length === 0 && <li className="px-5 py-6 text-center text-sm text-muted">Kein Treffer für „{q}“.</li>}
      </ul>
      {list.length > limit && (
        <Button variant="ghost" className="mt-2 w-full" onClick={() => setLimit(list.length)}>Alle {list.length} anzeigen</Button>
      )}
    </div>
  )
}

function NoteEditor({ note, cards, onClose }: { note: Note; cards: Card[]; onClose: () => void }) {
  const [n, setN] = useState(note)
  const suspended = cards.length > 0 && cards.every((c) => c.suspended)
  const field = (k: keyof Note, label: string) => (
    <div>
      <Label htmlFor={`${note.id}-${k}`}>{label}</Label>
      <Input id={`${note.id}-${k}`} value={(n[k] as string) ?? ''} onChange={(e) => setN({ ...n, [k]: e.target.value })} />
    </div>
  )
  return (
    <form
      className="space-y-4 border-t border-line bg-bg/50 px-4 py-4 desk:px-5"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!n.term.trim() || !n.translation.trim()) return
        await db.notes.put({ ...n, term: n.term.trim(), translation: n.translation.trim(), updatedAt: new Date().toISOString() })
        onClose()
      }}
    >
      <div className="grid gap-4 desk:grid-cols-2">
        {field('term', 'Fremdwort')}
        {field('translation', 'Deutsch (mehrere mit ; trennen)')}
        {field('example', 'Beispielsatz')}
        {field('mnemonic', 'Eselsbrücke')}
        {field('notes', 'Notiz')}
        <div>
          <Label>Genus</Label>
          <Segmented label="Genus" value={n.gender ?? ''} onChange={(v) => setN({ ...n, gender: (v || undefined) as Note['gender'] })} options={[{ value: '', label: '–' }, { value: 'm', label: 'm' }, { value: 'f', label: 'f' }, { value: 'n', label: 'n' }, { value: 'pl', label: 'pl' }]} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary">Speichern</Button>
        <Button type="button" onClick={async () => { await db.cards.bulkPut(cards.map((c) => ({ ...c, suspended: !suspended, updatedAt: new Date().toISOString() }))); onClose() }}>
          {suspended ? 'Entsperren' : 'Sperren'}
        </Button>
        <Button type="button" variant="danger" className="ml-auto" onClick={async () => { if (confirm(`„${note.term}“ löschen? Der Lernfortschritt dieses Wortes geht verloren.`)) await deleteNote(db, note.id) }}>
          <IconTrash width={16} height={16} /> Löschen
        </Button>
      </div>
    </form>
  )
}

function DeckSettings({ deck, unintroduced }: { deck: Deck; unintroduced: number }) {
  const [d, setD] = useState(deck)
  const [saved, setSaved] = useState(false)
  const perDay = d.examDate ? newPerDay(unintroduced, d.examDate, new Date()) : 0
  const save = async () => {
    const next = { ...d, name: d.name.trim() || deck.name, examDate: d.examDate || undefined, updatedAt: new Date().toISOString() }
    await db.decks.put(next)
    if (next.directions.join() !== deck.directions.join()) await syncDirections(db, next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }
  return (
    <Panel>
      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); void save() }}>
        <div>
          <Label htmlFor="ds-name">Name</Label>
          <Input id="ds-name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        </div>
        <div className="flex flex-wrap gap-6">
          <div>
            <Label>Sprache</Label>
            <Segmented label="Sprache" value={d.language} onChange={(v) => setD({ ...d, language: v })} options={[{ value: 'fr', label: 'Französisch' }, { value: 'en', label: 'Englisch' }, { value: 'other', label: 'Andere' }]} />
          </div>
          <div>
            <Label>Abfragen</Label>
            <DirectionPicker value={d.directions} onChange={(v) => setD({ ...d, directions: v })} language={d.language} />
          </div>
        </div>
        <div className="max-w-xs">
          <Label htmlFor="ds-exam" hint="(leer = normaler Modus)">Testdatum</Label>
          <div className="flex gap-2">
            <Input id="ds-exam" type="date" value={d.examDate ?? ''} onChange={(e) => setD({ ...d, examDate: e.target.value })} />
            {d.examDate && <Button type="button" variant="ghost" onClick={() => setD({ ...d, examDate: undefined })}>Entfernen</Button>}
          </div>
          {d.examDate && perDay > 0 && (
            <p className={`mt-2 text-sm ${needsWarning(perDay) ? 'text-bad' : 'text-muted'}`}>
              {perDay} neue Wörter pro Tag nötig{needsWarning(perDay) ? ' – knapp, plane 2 Sessions pro Tag.' : '.'} Die letzten 2 Tage sind nur Wiederholung.
            </p>
          )}
        </div>
        <Toggle checked={d.strictAccents} onChange={(v) => setD({ ...d, strictAccents: v })} label="Akzente streng bewerten" description="Wie im Test: ein fehlender Akzent zählt als Fehler." />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary">Speichern</Button>
          {saved && <span className="text-sm text-good" role="status">Gespeichert</span>}
        </div>
      </form>
      <div className="mt-8 border-t border-line pt-5">
        <SectionTitle>Deck entfernen</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Button onClick={async () => { await db.decks.put({ ...deck, archived: !deck.archived, updatedAt: new Date().toISOString() }); go('/decks') }}>
            {deck.archived ? 'Wiederherstellen' : 'Archivieren'}
          </Button>
          <Button variant="danger" onClick={async () => { if (confirm(`Deck „${deck.name}“ mit allen Wörtern und dem Lernfortschritt löschen? Das lässt sich nicht rückgängig machen.`)) { await deleteDeck(db, deck.id); go('/decks') } }}>
            <IconTrash width={16} height={16} /> Löschen
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted">Archivierte Decks erscheinen nicht mehr in der Tagesaufgabe, der Fortschritt bleibt erhalten.</p>
      </div>
    </Panel>
  )
}
