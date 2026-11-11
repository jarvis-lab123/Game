import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { planDay } from '../../db/queries'
import { createDeck } from '../../db/repo'
import type { Direction, Language } from '../../lib/types'
import { Badge, Button, Empty, Input, Label, PageHeader, Panel, Segmented, Toggle } from '../components'
import { Flag, IconChevron, IconPlus } from '../icons'
import { go } from '../router'

const dateFmt = new Intl.DateTimeFormat('de-CH', { day: 'numeric', month: 'short' })

export function Decks() {
  const plan = useLiveQuery(() => planDay(db, new Date()), [])
  const [creating, setCreating] = useState(false)
  const archived = useLiveQuery(() => db.decks.filter((d) => d.archived).toArray(), [])
  if (!plan) return <div className="h-40" aria-busy="true" />
  return (
    <div>
      <PageHeader title="Decks" subtitle="Deine Vokabellisten" action={<Button variant="primary" onClick={() => setCreating(true)}><IconPlus /> Neues Deck</Button>} />
      {creating && <NewDeckForm onDone={(id) => (setCreating(false), id && go(`/import?deck=${id}`))} />}
      {plan.decks.length === 0 && !creating ? (
        <Empty title="Noch kein Deck" action={<Button variant="primary" onClick={() => setCreating(true)}>Deck anlegen</Button>}>
          Ein Deck ist eine Vokabelliste, z. B. „Englisch Unit 4“. Danach importierst du die Wörter.
        </Empty>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
          {plan.decks.map((p) => (
            <li key={p.deck.id}>
              <a href={`#/deck/${p.deck.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-surface-2 desk:px-5">
                <Flag lang={p.deck.language} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.deck.name}</p>
                  <p className="text-sm text-muted tabular">
                    {p.total} Wörter · {p.due} fällig · {p.unintroduced} neu
                  </p>
                </div>
                {p.deck.examDate && p.exam && <Badge tone={p.exam.days <= 3 ? 'warn' : 'accent'}>Test {dateFmt.format(new Date(p.deck.examDate))}</Badge>}
                <IconChevron className="shrink-0 text-muted" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {archived && archived.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium text-muted">Archiviert ({archived.length})</summary>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-2xl bg-surface ring-1 ring-line">
            {archived.map((d) => (
              <li key={d.id}>
                <a href={`#/deck/${d.id}`} className="flex min-h-12 items-center gap-3 px-4 py-2 text-muted hover:bg-surface-2"><Flag lang={d.language} />{d.name}</a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export function DirectionPicker({ value, onChange, language }: { value: Direction[]; onChange: (v: Direction[]) => void; language: Language }) {
  const L = language === 'fr' ? 'FR' : language === 'en' ? 'EN' : 'Fremd'
  const opts: { value: string; label: string; dirs: Direction[] }[] = [
    { value: 'both', label: 'Beide', dirs: ['toTarget', 'toNative'] },
    { value: 'toTarget', label: `DE → ${L}`, dirs: ['toTarget'] },
    { value: 'toNative', label: `${L} → DE`, dirs: ['toNative'] },
  ]
  const cur = value.length === 2 ? 'both' : value[0]
  return <Segmented label="Richtungen" value={cur} onChange={(v) => onChange(opts.find((o) => o.value === v)!.dirs)} options={opts} />
}

export function NewDeckForm({ onDone }: { onDone: (id?: string) => void }) {
  const [name, setName] = useState('')
  const [language, setLanguage] = useState<Language>('fr')
  const [directions, setDirections] = useState<Direction[]>(['toTarget', 'toNative'])
  const [examDate, setExamDate] = useState('')
  const [strict, setStrict] = useState(false)
  return (
    <Panel className="mb-6">
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault()
          const d = await createDeck(db, { name, language, directions, examDate, strictAccents: strict })
          onDone(d.id)
        }}
      >
        <div>
          <Label htmlFor="deck-name">Name</Label>
          <Input id="deck-name" autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Franz Dossier 3" />
        </div>
        <div className="flex flex-wrap gap-6">
          <div>
            <Label>Sprache</Label>
            <Segmented label="Sprache" value={language} onChange={setLanguage} options={[{ value: 'fr', label: 'Französisch' }, { value: 'en', label: 'Englisch' }, { value: 'other', label: 'Andere' }]} />
          </div>
          <div>
            <Label hint="(getrennte Karten)">Abfragen</Label>
            <DirectionPicker value={directions} onChange={setDirections} language={language} />
          </div>
        </div>
        <div className="max-w-xs">
          <Label htmlFor="deck-exam" hint="(optional, aktiviert den Prüfungsmodus)">Testdatum</Label>
          <Input id="deck-exam" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
        </div>
        <Toggle checked={strict} onChange={setStrict} label="Akzente streng bewerten" description="Wie im Test: ein fehlender Akzent zählt als Fehler." />
        <div className="flex gap-2">
          <Button type="submit" variant="primary">Deck anlegen & importieren</Button>
          <Button type="button" variant="ghost" onClick={() => onDone()}>Abbrechen</Button>
        </div>
      </form>
    </Panel>
  )
}
