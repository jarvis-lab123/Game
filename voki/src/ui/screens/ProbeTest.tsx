import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Rating } from 'ts-fsrs'
import { db } from '../../db/db'
import { log } from '../../db/queries'
import { requestSync } from '../../db/autosync'
import type { Card, Deck, Note, TestItem } from '../../lib/types'
import { diffChars, gradeAnswer, normalize } from '../../lib/grade'
import { pickTestCards, swissGrade, TEST_SIZE } from '../../lib/probetest'
import { uid } from '../../lib/id'
import { Button, Empty, Kbd, Progress, cx } from '../components'
import { IconX } from '../icons'
import { Illustration } from '../illustrations'
import { go } from '../router'
import { AnswerInput, faceOf } from './cards'

interface Q { card: Card; note: Note }
interface A extends TestItem { expected: string }

export function ProbeTest({ deckId }: { deckId: string }) {
  const deck = useLiveQuery(() => db.decks.get(deckId), [deckId])
  const [qs, setQs] = useState<Q[] | null>(null)
  const [i, setI] = useState(0)
  const [confident, setConfident] = useState<boolean | null>(null)
  const [typed, setTyped] = useState('')
  const [answers, setAnswers] = useState<A[]>([])
  const [saved, setSaved] = useState<number | null>(null)
  const saving = useRef(false)

  useEffect(() => {
    ;(async () => {
      const d = await db.decks.get(deckId)
      if (!d) return setQs([])
      const cards = (await db.cards.where('deckId').equals(deckId).toArray()).filter((c) => d.directions.includes(c.direction))
      const picked = pickTestCards(cards, TEST_SIZE)
      const notes = new Map((await db.notes.bulkGet(picked.map((c) => c.noteId))).filter((n): n is Note => !!n).map((n) => [n.id, n]))
      setQs(picked.filter((c) => notes.has(c.noteId)).map((c) => ({ card: c, note: notes.get(c.noteId)! })))
    })()
  }, [deckId])

  const q = qs?.[i]
  const face = q && deck ? faceOf(q.card, q.note, deck) : null
  const done = qs && i >= qs.length && qs.length > 0

  const submit = () => {
    if (!q || !face || confident == null) return
    const r = gradeAnswer(typed, face.answer, { strictAccents: true, answerLang: face.answerLang })
    setAnswers((a) => [...a, { cardId: q.card.id, typed, correct: r.verdict === 'correct' || r.verdict === 'spelling', confident, expected: r.matched }])
    setTyped('')
    setConfident(null)
    setI((x) => x + 1)
  }

  // save result once
  useEffect(() => {
    if (!done || saved != null || !deck || !qs || saving.current) return
    saving.current = true
    ;(async () => {
      const correct = answers.filter((a) => a.correct).length
      const grade = swissGrade(correct, answers.length)
      const now = new Date().toISOString()
      await db.transaction('rw', db.tests, db.logs, db.notes, async () => {
        await db.tests.add({ id: uid(), deckId: deck.id, date: now, total: answers.length, correct, grade, items: answers.map(({ expected: _e, ...x }) => x), updatedAt: now })
        for (const a of answers) await log(db, { cardId: a.cardId, deckId: deck.id, timestamp: now, mode: 'test', rating: Rating.Manual, typedAnswer: a.typed, correct: a.correct, durationMs: 0 })
        // overconfident → Fehlerheft; a confident correct answer clears an old flag
        for (const a of answers) {
          const n = qs.find((x) => x.card.id === a.cardId)?.note
          if (!n) continue
          const fresh = await db.notes.get(n.id)
          if (!fresh) continue
          const has = fresh.tags.includes('überschätzt')
          if (a.confident && !a.correct && !has) await db.notes.put({ ...fresh, tags: [...fresh.tags, 'überschätzt'], updatedAt: now })
          if (a.confident && a.correct && has) await db.notes.put({ ...fresh, tags: fresh.tags.filter((t) => t !== 'überschätzt'), updatedAt: now })
        }
      })
      setSaved(grade)
      requestSync()
    })()
  }, [done, saved, deck, qs, answers])

  // keys: S / U for confidence
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return go('/ueben')
      if (confident == null && !(e.target instanceof HTMLInputElement)) {
        if (e.key.toLowerCase() === 's') setConfident(true)
        if (e.key.toLowerCase() === 'u') setConfident(false)
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })

  if (!qs || deck === undefined) return <div className="h-60" aria-busy="true" />
  if (!deck || qs.length === 0) return <div className="mx-auto max-w-[640px] px-4 pt-10"><Empty title="Keine Wörter für einen Probetest" action={<Button onClick={() => go('/ueben')}>Zurück</Button>} /></div>

  return (
    <div className="flex min-h-full flex-col">
      <header className="safe-top sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-[680px] items-center gap-3 px-4 py-3">
          <button onClick={() => go('/ueben')} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg" aria-label="Probetest abbrechen (Esc)"><IconX /></button>
          <Progress value={Math.min(i, qs.length) / qs.length} label="Fortschritt Probetest" />
          <span className="w-14 shrink-0 text-right text-sm text-muted tabular">{Math.min(i + 1, qs.length)}/{qs.length}</span>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[680px] flex-1 px-4 pb-10 pt-6 desk:pt-10">
        {done ? (
          <Result deck={deck} answers={answers} grade={saved ?? swissGrade(answers.filter((a) => a.correct).length, answers.length)} />
        ) : face && q ? (
          <div className="rounded-[26px] bg-surface p-6 shadow-card desk:p-10">
            <p className="text-sm font-medium text-muted">Probetest · {face.promptLabel} · Akzente zählen</p>
            <p className="mt-1 break-words text-[32px] font-semibold leading-tight tracking-tight desk:text-[36px]">{face.question}</p>
            {confident == null ? (
              <div className="mt-6">
                <p className="mb-3 text-[15px] font-medium">Wie sicher bist du – bevor du schreibst?</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button size="lg" onClick={() => setConfident(true)} kbd="S">Sicher</Button>
                  <Button size="lg" onClick={() => setConfident(false)} kbd="U">Unsicher</Button>
                </div>
              </div>
            ) : (
              <div className="mt-6">
                <AnswerInput key={i} value={typed} onChange={setTyped} onSubmit={submit} lang={face.answerLang} showAccents={face.answerLang === 'fr'} placeholder="Antwort … (leer lassen = weiss nicht)" ariaLabel="Deine Antwort" />
                <Button variant="primary" size="lg" className="mt-4 w-full desk:w-auto" onClick={submit} kbd="Enter">{i + 1 === qs.length ? 'Abgeben' : 'Weiter'}</Button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Result({ deck, answers, grade }: { deck: Deck; answers: A[]; grade: number }) {
  const correct = answers.filter((a) => a.correct).length
  const m = {
    sr: answers.filter((a) => a.confident && a.correct).length,
    sf: answers.filter((a) => a.confident && !a.correct).length,
    ur: answers.filter((a) => !a.confident && a.correct).length,
    uf: answers.filter((a) => !a.confident && !a.correct).length,
  }
  const calibrated = Math.round(((m.sr + m.uf) / Math.max(1, answers.length)) * 100)
  const pattern =
    m.sf >= 3 && m.sf > m.ur
      ? { t: 'Du hast dich überschätzt', d: `${m.sf} Wörter fühlten sich sicher an, waren aber falsch. Das passiert, wenn Wörter vertraut aussehen. Testen statt Durchlesen hilft.` }
      : m.ur >= 3 && m.ur > m.sf
        ? { t: 'Du kannst mehr, als du denkst', d: `${m.ur} Wörter wusstest du, obwohl du unsicher warst. Vertrau dir ein bisschen mehr.` }
        : { t: 'Gut eingeschätzt', d: 'Dein Gefühl passt zu deinem Wissen. Damit kannst du deine Lernzeit gezielt einsetzen.' }
  const wrong = answers.filter((a) => !a.correct)
  return (
    <div className="space-y-5">
      <div className="rounded-[26px] bg-surface p-8 text-center shadow-card">
        <div className="flex justify-center"><Illustration kind="test" size={96} /></div>
        <p className="mt-3 text-sm text-muted">{deck.name} · {correct} von {answers.length} richtig</p>
        <p className={cx('mt-1 text-[56px] font-semibold leading-none tracking-tight tabular', grade >= 5 ? 'text-good' : grade >= 4 ? 'text-warn' : 'text-bad')}>{grade.toFixed(1)}</p>
        <p className="mt-2 text-[15px] text-muted">Note nach Schweizer Skala (6 = alles richtig, 4 = 60 %)</p>
      </div>

      <div className="rounded-[26px] bg-surface p-6 shadow-card">
        <p className="text-[17px] font-semibold">{pattern.t}</p>
        <p className="mt-1 text-sm text-muted">{pattern.d}</p>
        <div className="mt-4 grid grid-cols-[auto_1fr_1fr] gap-1.5 text-sm" role="table" aria-label="Selbsteinschätzung">
          <span />
          <span className="text-center font-medium text-muted">richtig</span>
          <span className="text-center font-medium text-muted">falsch</span>
          <span className="self-center pr-2 font-medium text-muted">sicher</span>
          <span className="rounded-xl bg-good-soft py-3 text-center text-[20px] font-semibold text-good tabular">{m.sr}</span>
          <span className="rounded-xl bg-bad-soft py-3 text-center text-[20px] font-semibold text-bad tabular" title="überschätzt">{m.sf}</span>
          <span className="self-center pr-2 font-medium text-muted">unsicher</span>
          <span className="rounded-xl bg-accent-soft py-3 text-center text-[20px] font-semibold text-accent tabular" title="unterschätzt">{m.ur}</span>
          <span className="rounded-xl bg-surface-2 py-3 text-center text-[20px] font-semibold tabular">{m.uf}</span>
        </div>
        <p className="mt-3 text-sm text-muted tabular">Treffsicherheit deiner Einschätzung: {calibrated} %</p>
        {m.sf > 0 && <p className="mt-3 rounded-xl bg-warn-soft/70 px-3 py-2 text-sm">Nächster Schritt: Die {m.sf} überschätzten Wörter liegen jetzt im Fehlerheft. Üb sie heute noch einmal.</p>}
      </div>

      {wrong.length > 0 && (
        <div className="rounded-[26px] bg-surface p-6 shadow-card">
          <p className="mb-3 text-[17px] font-semibold">Korrektur</p>
          <ul className="space-y-3">
            {wrong.map((a) => (
              <li key={a.cardId}>
                <p className="text-[19px] font-semibold" aria-label={a.expected}>
                  {diffChars(normalize(a.typed), a.expected).map((d, k) => <span key={k} className={d.ok ? '' : 'rounded-[3px] bg-bad-soft text-bad'}>{d.ch}</span>)}
                </p>
                <p className="text-sm text-muted">{a.typed.trim() ? <>du: <span className="line-through">{a.typed}</span></> : 'leer gelassen'}{a.confident ? ' · warst sicher' : ''}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-col gap-2 desk:flex-row">
        <Button variant="primary" size="lg" onClick={() => go('/ueben')}>Zum Fehlerheft</Button>
        <Button size="lg" onClick={() => go(`/probetest?deck=${deck.id}&t=${Date.now()}`)}>Neuer Probetest</Button>
      </div>
      <p className="hidden text-center text-xs text-muted desk:block"><Kbd>S</Kbd> sicher · <Kbd>U</Kbd> unsicher · <Kbd>Enter</Kbd> weiter · <Kbd>Esc</Kbd> abbrechen</p>
    </div>
  )
}
