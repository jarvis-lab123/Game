import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { Deck, Note } from '../../lib/types'
import { speak } from '../../platform'
import { Button, Kbd, cx } from '../components'
import { IconBulb, IconFlame, IconSound } from '../icons'
import { Illustration } from '../illustrations'
import { MemoryAids, MnemonicStudio } from '../MnemonicStudio'
import { Pad, type PadHandle } from '../Pad'
import type { Face } from './cards'

/* ---------- Handschrift ---------- */
export type SelfGrade = 1 | 2 | 3
export function HandView({ face, note, revealed, onReveal }: { face: Face; note: Note; revealed: boolean; onReveal: () => void }) {
  const pad = useRef<PadHandle>(null)
  const [paper, setPaper] = useState(() => localStorage.getItem('voki.paper') === '1')
  useEffect(() => localStorage.setItem('voki.paper', paper ? '1' : '0'), [paper])
  return (
    <div>
      <p className="text-sm font-medium text-muted">{face.promptLabel} · von Hand</p>
      <p className="mt-1 break-words text-[32px] font-semibold leading-tight tracking-tight desk:text-[36px]">{face.question}</p>
      <div className="mt-5">
        {paper ? (
          <div className="grid h-[120px] place-items-center rounded-2xl border border-dashed border-line text-sm text-muted">Schreib das Wort auf dein Blatt.</div>
        ) : (
          <Pad ref={pad} height={170} label="Schreibfeld" />
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          {!paper ? (
            <button type="button" className="min-h-9 text-sm text-muted hover:text-fg" onClick={() => pad.current?.clear()}>Löschen</button>
          ) : <span />}
          <button type="button" className="min-h-9 text-sm font-medium text-accent hover:underline" onClick={() => setPaper((p) => !p)}>
            {paper ? 'Auf dem Bildschirm schreiben' : 'Lieber auf Papier'}
          </button>
        </div>
      </div>
      {revealed ? (
        <div className="mt-5 rounded-[22px] bg-surface-2/70 px-4 py-3" role="status">
          <p className="text-sm text-muted">Lösung – vergleiche Buchstabe für Buchstabe</p>
          <p className="mt-1 break-words text-[30px] font-semibold leading-tight tracking-tight" lang={face.answerLang}>{face.answer}</p>
          <div className="mt-3"><MemoryAids note={note} /></div>
        </div>
      ) : (
        <Button variant="primary" size="lg" className="mt-5 w-full desk:w-auto" onClick={onReveal} kbd="Enter">Lösung zeigen</Button>
      )}
    </div>
  )
}

export function SelfGradeButtons({ onGrade }: { onGrade: (g: SelfGrade) => void }) {
  const opts: { g: SelfGrade; label: string; sub: string; tone: string }[] = [
    { g: 1, label: 'Falsch', sub: 'nochmal', tone: 'text-bad' },
    { g: 2, label: 'Fast', sub: 'Akzent/Kleinigkeit', tone: 'text-warn' },
    { g: 3, label: 'Richtig', sub: 'genau so', tone: 'text-good' },
  ]
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Selbst bewerten">
      {opts.map((o) => (
        <Button key={o.g} onClick={() => onGrade(o.g)} className="h-auto flex-col gap-0 py-2.5">
          <span className={o.tone}>{o.label}</span>
          <span className="text-xs font-normal text-muted">{o.sub}</span>
          <Kbd className="mt-1 hidden desk:inline-flex">{o.g}</Kbd>
        </Button>
      ))}
    </div>
  )
}

/* ---------- Hören ---------- */
export function ListenPrompt({ face }: { face: Face }) {
  useEffect(() => {
    const t = setTimeout(() => speak(face.foreign, face.foreignLang), 250)
    return () => clearTimeout(t)
  }, [face.foreign, face.foreignLang])
  return (
    <div>
      <p className="text-sm font-medium text-muted">Hör zu – was bedeutet das Wort?</p>
      <button
        type="button"
        onClick={() => speak(face.foreign, face.foreignLang)}
        className="mt-3 flex min-h-20 w-full items-center justify-center gap-3 rounded-2xl bg-accent-soft text-accent transition-colors duration-150 hover:brightness-95"
        aria-label="Nochmal anhören (Ctrl+Leertaste)"
      >
        <IconSound width={30} height={30} />
        <span className="text-[17px] font-medium">Nochmal anhören</span>
      </button>
    </div>
  )
}

/* ---------- Hinweis-Leiter ---------- */
export function HintBar({ steps, used, onMore }: { steps: string[]; used: number; onMore: () => void }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 3000) // first try on your own
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="mt-3">
      {used > 0 && (
        <ol className="mb-2 space-y-1.5" aria-live="polite">
          {steps.slice(0, used).map((h, i) => (
            <li key={i} className="rounded-xl bg-warn-soft/70 px-3 py-2 font-mono text-[15px] tracking-wide text-fg">{h}</li>
          ))}
        </ol>
      )}
      {used < steps.length && (
        <div className="flex flex-wrap items-center gap-x-2">
          <button
            type="button"
            disabled={!ready}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onMore}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-warn transition-opacity disabled:opacity-40"
            title={ready ? undefined : 'Versuch es zuerst selbst'}
          >
            <IconBulb width={16} height={16} /> {used === 0 ? 'Hinweis' : 'Noch ein Hinweis'}
          </button>
          <span className="text-xs text-muted">{used === 0 ? 'zählt dann als „schwer“' : 'dann zählt es als „falsch“'}</span>
        </div>
      )}
    </div>
  )
}

/* ---------- Problemwort-Pause (§5.7) ---------- */
export function LeechPause({ note, deck, onSaved, onContinue }: { note: Note; deck: Deck; onSaved: (n: Note) => void; onContinue: () => void }) {
  const [draft, setDraft] = useState('')
  const hasAid = !!(note.mnemonic || note.emoji || note.sketch || draft.trim().length >= 3)
  return (
    <div>
      <div className="flex items-center gap-2 text-warn">
        <IconFlame width={20} height={20} />
        <p className="text-[15px] font-semibold">Problemwort – kurze Pause</p>
      </div>
      <p className="mt-1 text-sm text-muted">Dieses Wort ging schon 4-mal verloren. Bau dir jetzt eine Eselsbrücke, dann sitzt es.</p>
      <p className="mt-4 break-words text-[30px] font-semibold leading-tight tracking-tight" lang={deck.language}>{note.term}</p>
      <p className="mt-1 text-[19px] text-fg/90">{note.translation}</p>
      <div className="mt-5 border-t border-line pt-5">
        <MnemonicStudio note={note} language={deck.language} onSaved={onSaved} onDraft={setDraft} />
      </div>
      <Button variant="primary" size="lg" className="mt-6 w-full desk:w-auto" disabled={!hasAid} onClick={onContinue}>
        {hasAid ? 'Weiter zur Abfrage' : 'Erst eine Eselsbrücke, Emoji oder Skizze'}
      </Button>
    </div>
  )
}

/* ---------- Zwischen den Gruppen ---------- */
export function GroupBreak({ done, total, words, onNext }: { done: number; total: number; words: { term: string; translation: string; emoji?: string }[]; onNext: () => void }) {
  const reduce = useReducedMotion()
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Enter' && !(e.target instanceof HTMLButtonElement) && onNext()
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [onNext])
  return (
    <motion.div initial={reduce ? false : { opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.22 }} className="rounded-[26px] bg-surface p-8 text-center shadow-card">
      <div className="flex justify-center"><Illustration kind="group" size={104} /></div>
      <h2 className="mt-4 text-[24px] font-semibold tracking-tight">Gruppe {done} von {total} geschafft</h2>
      <div className="mx-auto mt-3 flex max-w-xs justify-center gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => <span key={i} className={cx('h-1.5 flex-1 rounded-full', i < done ? 'bg-accent' : 'bg-surface-2')} />)}
      </div>
      {words.length > 0 && (
        <ul className="mx-auto mt-6 max-w-sm space-y-1 text-left text-[15px]">
          {words.map((w) => (
            <li key={w.term} className="flex items-baseline gap-2"><span className="w-6 shrink-0 text-center">{w.emoji ?? '·'}</span><span className="font-medium">{w.term}</span><span className="text-muted">– {w.translation}</span></li>
          ))}
        </ul>
      )}
      <p className="mt-5 text-sm text-muted">Kurz durchatmen. Die Wörter kommen in den nächsten Tagen wieder.</p>
      <Button variant="primary" size="lg" className="mt-6 w-full desk:w-auto" onClick={onNext} kbd="Enter">Nächste Gruppe</Button>
    </motion.div>
  )
}
