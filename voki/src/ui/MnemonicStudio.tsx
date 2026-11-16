import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Language, Note } from '../lib/types'
import { suggestMnemonics } from '../lib/mnemonic'
import { Button, TextArea, cx } from './components'
import { IconBulb } from './icons'
import { Pad, type PadHandle } from './Pad'

export const EMOJI = ['🏠', '🍞', '🥐', '☕', '🍎', '🧀', '🚗', '🚲', '✈️', '🚆', '🏫', '📚', '✏️', '💡', '⏰', '📅', '☀️', '🌧️', '❄️', '🌳', '🌊', '⛰️', '🐶', '🐱', '🐟', '👨', '👩', '👶', '👫', '❤️', '😀', '😢', '😡', '😴', '🏃', '🗣️', '👂', '👀', '✋', '💰', '🛒', '🎵', '⚽', '🎁', '🔑', '🚪', '🛏️', '🍽️', '🔥', '⭐', '❓', '✅']

const KIND_LABEL = { genus: 'Genus', wortteil: 'Wortteil', ähnlich: 'Ähnlich' } as const

/**
 * Eselsbrücken-Werkstatt: automatic hooks + own sentence + emoji + sketch (dual coding).
 * Saves directly to the note.
 */
export function MnemonicStudio({ note, language, compact, onSaved, onDraft }: { note: Note; language: Language; compact?: boolean; onSaved?: (n: Note) => void; onDraft?: (text: string) => void }) {
  const others = useLiveQuery(() => db.notes.where('deckId').notEqual(note.deckId).limit(3000).toArray(), [note.deckId])
  const suggestions = useMemo(() => suggestMnemonics(note, language, others ?? []), [note, language, others])
  const [text, setText] = useState(note.mnemonic ?? '')
  const [open, setOpen] = useState(!compact)
  const [emoji, setEmoji] = useState(note.emoji)
  const pad = useRef<PadHandle>(null)

  const save = async (patch: Partial<Note>) => {
    // only the changed fields, against the stored record (a parallel save must not be undone)
    await db.notes.update(note.id, { ...patch, updatedAt: new Date().toISOString() })
    const n = await db.notes.get(note.id)
    if (n) onSaved?.(n)
  }

  return (
    <div className="space-y-3">
      {suggestions.length > 0 && (
        <ul className="space-y-1.5" aria-label="Vorschläge">
          {suggestions.map((s) => (
            <li key={s.text} className="rounded-xl bg-surface-2/60 px-3 py-2 text-sm">
              <span className="mr-1.5 rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">{KIND_LABEL[s.kind]}</span>
              {s.text}{' '}
              <button type="button" className="font-medium text-accent hover:underline" onClick={() => setText((t) => (t ? `${t} ${s.text}` : s.text))}>
                übernehmen
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="block">
        <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"><IconBulb width={16} height={16} className="text-warn" /> Deine Eselsbrücke</span>
        <TextArea
          rows={2}
          value={text}
          placeholder="Bild, Klang, Geschichte … je verrückter, desto besser"
          onChange={(e) => {
            setText(e.target.value)
            onDraft?.(e.target.value)
          }}
          onBlur={() => text !== (note.mnemonic ?? '') && save({ mnemonic: text.trim() || undefined })}
        />
      </label>
      {!open ? (
        <button type="button" className="min-h-9 text-sm font-medium text-accent hover:underline" onClick={() => setOpen(true)}>
          + Bild, Emoji oder Skizze dazu
        </button>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-sm font-medium">Emoji <span className="font-normal text-muted">(ein Bild sagt mehr als ein Wort)</span></p>
            <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto" role="radiogroup" aria-label="Emoji wählen">
              {EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  role="radio"
                  aria-checked={emoji === e}
                  onClick={() => {
                    const v = emoji === e ? undefined : e
                    setEmoji(v)
                    void save({ emoji: v })
                  }}
                  className={cx('grid h-10 w-10 place-items-center rounded-xl text-[20px] transition-colors duration-100', emoji === e ? 'bg-accent-soft ring-2 ring-accent' : 'hover:bg-surface-2')}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Skizze <span className="font-normal text-muted">(zeichne dein Merkbild)</span></p>
            <Pad ref={pad} height={150} initial={note.sketch} label={`Skizze zu ${note.term}`} />
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => save({ sketch: pad.current?.toDataURL(480) ?? undefined })}>Skizze speichern</Button>
              <Button size="sm" variant="ghost" onClick={() => { pad.current?.clear(); void save({ sketch: undefined }) }}>Löschen</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Compact display of a word's memory aids (emoji, sketch, text) – shown after answers. */
export function MemoryAids({ note }: { note: Note }) {
  if (!note.mnemonic && !note.emoji && !note.sketch) return null
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-warn-soft/60 px-4 py-3">
      {note.emoji && <span className="text-[28px] leading-none">{note.emoji}</span>}
      {note.sketch && <img src={note.sketch} alt="Deine Skizze" className="h-14 w-24 rounded-lg bg-surface object-contain shadow-card" />}
      {note.mnemonic && <p className="min-w-0 flex-1 text-sm"><span className="font-medium">Eselsbrücke:</span> {note.mnemonic}</p>}
    </div>
  )
}
