import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import { importNotes } from '../../db/repo'
import { CLAUDE_PROMPT, COLUMN_LABELS, guessMapping, mapRows, parseDelimited, type Column } from '../../lib/tsv'
import { normalize } from '../../lib/grade'
import { copyText } from '../../platform'
import { Badge, Button, Empty, Label, PageHeader, Panel, Select, TextArea, Toggle, cx } from '../components'
import { IconCheck, IconCopy, IconImport, IconPlay } from '../icons'
import { go } from '../router'
import { NewDeckForm } from './Decks'
import { restoreFromFile } from './SettingsScreen'

const PREVIEW = 200

export function ImportScreen({ deckId }: { deckId?: string }) {
  const decks = useLiveQuery(() => db.decks.filter((d) => !d.archived).toArray(), [])
  const [target, setTarget] = useState<string>(deckId ?? '')
  const [text, setText] = useState('')
  const [header, setHeader] = useState(false)
  const [mapping, setMapping] = useState<Column[] | null>(null)
  const [copied, setCopied] = useState(false)
  const [done, setDone] = useState<{ n: number; deckId: string } | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const deck = decks?.find((d) => d.id === (target || decks?.[0]?.id))
  const existing = useLiveQuery(async () => (deck ? new Set((await db.notes.where('deckId').equals(deck.id).toArray()).map((n) => normalize(n.term))) : new Set<string>()), [deck?.id])

  const parsed = useMemo(() => parseDelimited(text), [text])
  const rows = header ? parsed.rows.slice(1) : parsed.rows
  const cols = Math.max(0, ...parsed.rows.map((r) => r.length))
  const map = mapping && mapping.length === cols ? mapping : guessMapping(cols)
  const drafts = useMemo(() => mapRows(rows, map, existing ?? new Set()), [rows, map, existing])
  const ok = drafts.filter((d) => d.valid && !d.duplicate).length
  const dupes = drafts.filter((d) => d.duplicate).length
  const invalid = drafts.filter((d) => !d.valid).length

  if (!decks) return <div className="h-40" aria-busy="true" />
  if (decks.length === 0)
    return (
      <div>
        <PageHeader title="Import" subtitle="Lege zuerst ein Deck an, in das die Wörter kommen." />
        <NewDeckForm onDone={(id) => id && setTarget(id)} />
      </div>
    )

  if (done)
    return (
      <div>
        <PageHeader title="Import" />
        <Panel className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-good-soft text-good"><IconCheck /></span>
          <p className="mt-3 text-[20px] font-semibold">{done.n} Wörter importiert</p>
          <p className="mt-1 text-muted">Sie kommen ab jetzt in deine Tagesaufgabe.</p>
          <div className="mt-6 flex flex-col justify-center gap-2 desk:flex-row">
            <Button variant="primary" onClick={() => go(`/lernen?deck=${done.deckId}`)}><IconPlay /> Jetzt lernen</Button>
            <Button onClick={() => go(`/deck/${done.deckId}`)}>Wörter ansehen</Button>
            <Button variant="ghost" onClick={() => { setDone(null); setText('') }}>Weitere importieren</Button>
          </div>
        </Panel>
      </div>
    )

  const onFile = async (f: File) => {
    setError('')
    const content = await f.text()
    if (f.name.toLowerCase().endsWith('.json')) {
      try {
        if (await restoreFromFile(content)) go('/')
      } catch (e) {
        setError((e as Error).message)
      }
      return
    }
    setText(content)
    setMapping(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Import" subtitle="Vokabeln einfügen, als Datei laden oder per Foto mit Claude umwandeln." />

      <Panel>
        <ol className="grid gap-4 text-[15px] desk:grid-cols-3">
          {['Vokabelliste im Buch fotografieren.', 'Foto + Prompt an Claude schicken.', 'Antwort kopieren und unten einfügen.'].map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent">{i + 1}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
        <Button className="mt-5" onClick={async () => { if (await copyText(CLAUDE_PROMPT)) { setCopied(true); setTimeout(() => setCopied(false), 2000) } }}>
          {copied ? <><IconCheck width={18} height={18} className="text-good" /> Kopiert</> : <><IconCopy width={18} height={18} /> Prompt für Claude kopieren</>}
        </Button>
      </Panel>

      <Panel>
        <div className="grid gap-5 desk:grid-cols-[1fr_auto] desk:items-end">
          <div>
            <Label htmlFor="imp-deck">Ziel-Deck</Label>
            <Select id="imp-deck" value={deck?.id} onChange={(e) => (e.target.value === '__new' ? go('/decks') : setTarget(e.target.value))}>
              {decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              <option value="__new">+ Neues Deck …</option>
            </Select>
          </div>
          <div>
            <input ref={fileRef} aria-label="Vokabel-Datei wählen" type="file" accept=".tsv,.csv,.txt,.json,text/plain,text/csv,application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            <Button onClick={() => fileRef.current?.click()}><IconImport /> Datei wählen</Button>
          </div>
        </div>
        <div className="mt-5">
          <Label htmlFor="imp-text" hint="(Tab, ; oder , getrennt, eine Vokabel pro Zeile)">Einfügen</Label>
          <TextArea id="imp-text" rows={8} value={text} onChange={(e) => { setText(e.target.value); setMapping(null) }} className="font-mono text-[14px]" placeholder={"la boulangerie\tdie Bäckerei\tJe vais à la boulangerie.\tf\nle pain\tdas Brot\tLe pain est frais.\tm"} />
        </div>
        {error && <p className="mt-3 rounded-xl bg-bad-soft px-4 py-3 text-sm text-bad" role="alert">{error}</p>}
      </Panel>

      {rows.length > 0 && cols > 0 && (
        <Panel className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
            <div className="flex flex-wrap gap-2">
              <Badge tone="good">{ok} neu</Badge>
              {dupes > 0 && <Badge tone="warn">{dupes} Duplikate</Badge>}
              {invalid > 0 && <Badge tone="bad">{invalid} unvollständig</Badge>}
            </div>
            <div className="w-full desk:w-auto"><Toggle checked={header} onChange={setHeader} label="Erste Zeile ist Kopfzeile" /></div>
          </div>
          <div className="mt-4 max-h-[420px] overflow-auto border-b border-line">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="sticky top-0 z-[1] border-y border-line bg-surface">
                  {map.map((c, i) => (
                    <th key={i} className="px-3 py-2 font-medium">
                      <Select aria-label={`Spalte ${i + 1}`} className="min-h-11 min-w-36 py-1.5 text-sm desk:min-h-9" value={c} onChange={(e) => { const m = [...map]; m[i] = e.target.value as Column; setMapping(m) }}>
                        {(Object.keys(COLUMN_LABELS) as Column[]).map((k) => <option key={k} value={k}>{COLUMN_LABELS[k]}</option>)}
                      </Select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, PREVIEW).map((r, ri) => {
                  const d = drafts[ri]
                  return (
                    <tr key={ri} className={cx('border-b border-line last:border-0', (d.duplicate || !d.valid) && 'text-muted')}>
                      {map.map((_, ci) => (
                        <td key={ci} className="max-w-56 truncate px-3 py-2">
                          {ci === 0 && d.duplicate && <Badge tone="warn">Duplikat</Badge>} {ci === 0 && !d.valid && <Badge tone="bad">fehlt</Badge>} {r[ci] ?? ''}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {rows.length > PREVIEW && <p className="px-5 pt-3 text-sm text-muted">… und {rows.length - PREVIEW} weitere Zeilen</p>}
          <div className="flex flex-wrap items-center gap-3 p-5">
            <Button
              variant="primary"
              size="lg"
              disabled={ok === 0 || !deck}
              onClick={async () => {
                if (!deck) return
                const n = await importNotes(db, deck.id, drafts, deck.directions)
                setDone({ n, deckId: deck.id })
              }}
            >
              {ok} Wörter importieren
            </Button>
            <p className="text-sm text-muted">
              Pro Wort {deck?.directions.length === 2 ? '2 Karten (beide Richtungen)' : '1 Karte'}. Duplikate werden übersprungen.
            </p>
          </div>
        </Panel>
      )}
      {rows.length === 0 && text.trim() === '' && <Empty title="Noch nichts eingefügt">Füge oben Zeilen ein oder wähle eine Datei. Die Vorschau erscheint hier.</Empty>}
    </div>
  )
}
