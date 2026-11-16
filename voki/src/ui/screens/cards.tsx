import { useEffect, useRef, type KeyboardEvent as RKE, type ReactNode } from 'react'
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import type { Card, Deck, Note } from '../../lib/types'
import { diffChars, normalize, type AnswerLang, type GradeResult } from '../../lib/grade'
import { ACCENT_BAR, baseOf, cycleAccent } from '../../lib/accents'
import { speak } from '../../platform'
import { Badge, Button, Input, Kbd, cx } from '../components'
import { IconCheck, IconFlame, IconSound, IconX } from '../icons'
import { MnemonicStudio } from '../MnemonicStudio'

export interface Face {
  question: string
  answer: string
  answerLang: AnswerLang
  promptLabel: string
  /** Text to read aloud: always the foreign word. */
  foreign: string
  foreignLang: Deck['language']
}

const LANG_NAME = { fr: 'Französisch', en: 'Englisch', other: 'in der Fremdsprache' } as const
const GENDER = { m: 'männlich', f: 'weiblich', n: 'neutrum', pl: 'Plural' } as const

export function faceOf(card: Card, note: Note, deck: Deck): Face {
  const toTarget = card.direction === 'toTarget'
  return {
    question: toTarget ? note.translation : note.term,
    answer: toTarget ? note.term : note.translation,
    answerLang: toTarget ? (deck.language === 'other' ? 'other' : deck.language) : 'de',
    promptLabel: toTarget ? (deck.language === 'other' ? 'Übersetze' : `Auf ${LANG_NAME[deck.language]}`) : 'Auf Deutsch',
    foreign: note.term,
    foreignLang: deck.language,
  }
}

export function AudioButton({ text, lang }: { text: string; lang: Deck['language'] }) {
  if (lang === 'other' || !('speechSynthesis' in window)) return null
  return (
    <button
      type="button"
      onClick={() => speak(text, lang)}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
      aria-label="Aussprache anhören (Ctrl+Leertaste)"
      title="Aussprache (Ctrl+Leertaste)"
    >
      <IconSound />
    </button>
  )
}

export function CardShell({ children, shake, label }: { children: ReactNode; shake?: number; label?: ReactNode }) {
  const reduce = useReducedMotion()
  const controls = useAnimationControls()
  // shake on a wrong answer without re-mounting (no fade flicker)
  useEffect(() => {
    if (shake && !reduce) void controls.start({ x: [0, -7, 7, -4, 4, 0], transition: { duration: 0.24 } })
  }, [shake, reduce, controls])
  return (
    <motion.div animate={controls} className="w-full">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="w-full rounded-[26px] bg-surface p-6 shadow-card desk:p-10"
      >
        {label && <div className="mb-4 flex flex-wrap items-center gap-2">{label}</div>}
        {children}
      </motion.div>
    </motion.div>
  )
}

export function StepLabel({ step, leech }: { step: string; leech?: boolean }) {
  const text = { intro: 'Neues Wort', mc: 'Auswählen', type: 'Schreiben', review: 'Wiederholung', practice: 'Nochmal üben', cram: 'Extra vor dem Test', dmc: 'Fehlerheft' }[step] ?? step
  return (
    <>
      <Badge tone={step === 'intro' || step === 'mc' || step === 'type' ? 'accent' : 'neutral'}>{text}</Badge>
      {leech && <Badge tone="warn"><IconFlame width={12} height={12} /> Problemwort</Badge>}
    </>
  )
}

/* ---------- Intro ---------- */
export function IntroView({ note, deck, onSaved }: { note: Note; deck: Deck; onSaved: (n: Note) => void }) {
  useEffect(() => {
    speak(note.term, deck.language)
  }, [note.term, deck.language])
  return (
    <div>
      <div className="flex items-start gap-3">
        {note.emoji && <span className="text-[40px] leading-none" aria-hidden>{note.emoji}</span>}
        <p className="min-w-0 flex-1 break-words text-[34px] font-semibold leading-tight tracking-tight desk:text-[40px]" lang={deck.language}>{note.term}</p>
        <AudioButton text={note.term} lang={deck.language} />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {note.gender && <Badge tone={note.gender === 'f' ? 'bad' : note.gender === 'm' ? 'accent' : 'neutral'}>{GENDER[note.gender]}</Badge>}
        {note.plural && <Badge>Pl. {note.plural}</Badge>}
      </div>
      <p className="mt-4 text-[22px] text-fg/90">{note.translation}</p>
      {note.example && <p className="mt-4 border-l-2 border-accent/50 pl-3 text-[16px] italic text-muted" lang={deck.language}>{note.example}</p>}
      {note.notes && <p className="mt-3 text-sm text-muted">{note.notes}</p>}
      {note.sketch && <img src={note.sketch} alt="Deine Skizze" className="mt-4 h-24 rounded-xl bg-surface-2 object-contain shadow-card" />}
      <div className="mt-6 border-t border-line pt-5">
        <MnemonicStudio note={note} language={deck.language} compact onSaved={onSaved} />
      </div>
    </div>
  )
}

/* ---------- Multiple choice ---------- */
export function McView({ face, options, picked, onPick }: { face: Face; options: string[]; picked: number | null; onPick: (i: number) => void }) {
  const correct = options.findIndex((o) => o === face.answer)
  return (
    <div>
      <p className="text-sm font-medium text-muted">{face.promptLabel}</p>
      <p className="mt-1 break-words text-[32px] font-semibold leading-tight tracking-tight desk:text-[36px]">{face.question}</p>
      <div className="mt-6 grid gap-2.5 desk:grid-cols-2">
        {options.map((o, i) => {
          const state = picked == null ? 'idle' : i === correct ? 'right' : i === picked ? 'wrong' : 'dim'
          return (
            <button
              key={o + i}
              disabled={picked != null}
              onClick={() => onPick(i)}
              className={cx(
                'flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 text-left text-[16px] ring-1 ring-inset transition-colors duration-150',
                state === 'idle' && 'ring-line hover:bg-surface-2 hover:ring-accent/40',
                state === 'right' && 'bg-good-soft text-good ring-good/50',
                state === 'wrong' && 'bg-bad-soft text-bad ring-bad/50',
                state === 'dim' && 'opacity-50 ring-line',
              )}
            >
              <Kbd className="shrink-0">{i + 1}</Kbd>
              <span className="min-w-0 flex-1 break-words">{o}</span>
              {state === 'right' && <IconCheck />}
              {state === 'wrong' && <IconX />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- Typing ---------- */
export function AccentBar({ onInsert }: { onInsert: (ch: string) => void }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Sonderzeichen">
      {ACCENT_BAR.map((ch) => (
        <button
          key={ch}
          type="button"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(ch)}
          className="grid h-11 min-w-11 place-items-center rounded-xl bg-surface-2 text-[17px] ring-1 ring-inset ring-line transition-colors duration-100 hover:bg-accent-soft active:bg-accent-soft"
        >
          {ch}
        </button>
      ))}
    </div>
  )
}

export function useAccentInput(value: string, setValue: (v: string) => void) {
  const ref = useRef<HTMLInputElement>(null)
  const insert = (ch: string, replacePrev = false) => {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const from = replacePrev ? start - 1 : start
    const next = value.slice(0, from) + ch + value.slice(end)
    setValue(next)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(from + ch.length, from + ch.length)
    })
  }
  /** Alt + letter cycles accent variants (§5.5). */
  const onKeyDown = (e: RKE<HTMLInputElement>) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || !e.code.startsWith('Key')) return
    const letter = e.code.slice(3).toLowerCase()
    const first = cycleAccent(letter)
    if (!first) return
    e.preventDefault()
    const el = e.currentTarget
    const pos = el.selectionStart ?? value.length
    const prev = value[pos - 1]
    if (prev && baseOf(prev) === letter) insert(cycleAccent(prev)!, true)
    else insert(e.shiftKey ? first.toUpperCase() : first)
  }
  return { ref, insert, onKeyDown }
}

export function AnswerInput({ value, onChange, onSubmit, lang, showAccents, placeholder, ariaLabel, tone }: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  lang: AnswerLang
  showAccents: boolean
  placeholder: string
  ariaLabel: string
  tone?: 'bad'
}) {
  const { ref, insert, onKeyDown } = useAccentInput(value, onChange)
  useEffect(() => {
    ref.current?.focus()
  }, [ref])
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
      <Input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        lang={lang === 'de' ? 'de' : lang}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="done"
        aria-label={ariaLabel}
        placeholder={placeholder}
        className={cx('min-h-14 text-[19px]', tone === 'bad' && 'ring-bad/60')}
      />
      {showAccents && <AccentBar onInsert={(ch) => insert(ch)} />}
    </form>
  )
}

const VERDICT_COPY: Record<GradeResult['verdict'], (lang: AnswerLang, strict: boolean) => { title: string; tone: 'good' | 'warn' | 'bad' }> = {
  correct: () => ({ title: 'Richtig', tone: 'good' }),
  accent: (_l, strict) => ({ title: strict ? 'Akzent falsch – im Test zählt das als Fehler' : 'Fast – achte auf die Akzente', tone: strict ? 'bad' : 'warn' }),
  typo: () => ({ title: 'Fast! Ein Buchstabe stimmt nicht', tone: 'warn' }),
  article: (lang) => (lang === 'fr' ? { title: 'Genus! Der Artikel stimmt nicht', tone: 'bad' } : { title: 'Fast – Artikel bzw. „to“ beachten', tone: 'warn' }),
  wrong: () => ({ title: 'Nicht ganz', tone: 'bad' }),
}

export function FeedbackView({ result, typed, face, strict }: { result: GradeResult; typed: string; face: Face; strict: boolean }) {
  const c = VERDICT_COPY[result.verdict](face.answerLang, strict)
  const reduce = useReducedMotion()
  const tone = { good: 'text-good bg-good-soft', warn: 'text-warn bg-warn-soft', bad: 'text-bad bg-bad-soft' }[c.tone]
  return (
    <div className="mt-5" role="status" aria-live="polite">
      <div className={cx('flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[15px] font-medium', tone)}>
        <motion.span initial={reduce ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.18 }}>
          {c.tone === 'good' ? <IconCheck /> : <IconX />}
        </motion.span>
        {c.title}
      </div>
      {result.verdict !== 'correct' && (
        <div className="mt-4">
          <p className="text-sm text-muted">Richtig ist</p>
          <p className="mt-1 break-words text-[30px] font-semibold leading-tight tracking-tight" lang={face.answerLang} aria-label={result.matched}>
            {diffChars(normalize(typed), result.matched).map((d, i) => (
              <span key={i} className={d.ok ? '' : 'rounded-[4px] bg-bad-soft text-bad underline decoration-2 underline-offset-4'}>{d.ch}</span>
            ))}
          </p>
          {typed.trim() && <p className="mt-1 text-sm text-muted">Deine Antwort: <span className="line-through">{typed}</span></p>}
        </div>
      )}
    </div>
  )
}

/* ---------- Flip ---------- */
export function FlipView({ face, flipped }: { face: Face; flipped: boolean }) {
  const reduce = useReducedMotion()
  return (
    <div className="[perspective:1200px]">
      <p className="text-sm font-medium text-muted">{face.promptLabel}</p>
      <p className="mt-1 break-words text-[32px] font-semibold leading-tight tracking-tight desk:text-[36px]">{face.question}</p>
      <motion.div
        initial={false}
        animate={{ rotateX: flipped || reduce ? 0 : -90, opacity: flipped ? 1 : 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="mt-6 origin-top border-t border-line pt-6"
        aria-hidden={!flipped}
      >
        <p className="break-words text-[28px] font-semibold leading-tight" lang={face.answerLang}>{face.answer}</p>
      </motion.div>
    </div>
  )
}

export const FLIP_RATINGS = [
  { r: 1, label: 'Nochmal', tone: 'text-bad' },
  { r: 2, label: 'Schwer', tone: 'text-warn' },
  { r: 3, label: 'Gut', tone: 'text-good' },
  { r: 4, label: 'Leicht', tone: 'text-accent' },
] as const

export function FlipRatings({ onRate }: { onRate: (r: 1 | 2 | 3 | 4) => void }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {FLIP_RATINGS.map((x) => (
        <Button key={x.r} onClick={() => onRate(x.r)} className="h-auto flex-col gap-0 py-2">
          <span className={x.tone}>{x.label}</span>
          <Kbd className="mt-0.5 hidden desk:inline-flex">{x.r}</Kbd>
        </Button>
      ))}
    </div>
  )
}
