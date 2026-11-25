/**
 * Knacknuss-Training: words you can't yet, drilled with many different exercises.
 * Evidence-based ideas behind it:
 *  - retrieval practice beats re-reading (testing effect)
 *  - fading cues: start with lots of help, remove it step by step (vanishing cues)
 *  - generation: building the word yourself (letter tiles) sticks better than reading it
 *  - context: the word in its sentence (cloze)
 *  - dual channels: hear it and write it (dictation), say it aloud (production effect)
 *  - interleaving and short spacing inside the session: words take turns, a wrong one comes back later
 *  - keyword method / mnemonics on the learn card
 * Each word climbs a ladder of exercises; a mistake sends it one rung down and back into the queue.
 * A word is „geknackt“ when the final free recall is right twice (with other words in between).
 */
import { solutions } from './grade'

export type Exercise = 'scramble' | 'cloze' | 'fade' | 'listen' | 'write' | 'final'

export interface TrainerWord { id: string; hasCloze: boolean; canListen: boolean }

export const EXERCISE_LABEL: Record<Exercise, string> = {
  scramble: 'Buchstabensalat',
  cloze: 'Lückentext',
  fade: 'Verblassende Hilfe',
  listen: 'Hören & schreiben',
  write: 'Aus dem Kopf',
  final: 'Nochmal aus dem Kopf',
}

/** Only gap sentences: every word must be filled in right twice (with other sentences in between). */
export const CLOZE_ONLY: Exercise[] = ['cloze', 'cloze']

/**
 * New words, quick: after the learn card and the pairs, translate the word once (normal form),
 * then write it in its sentence the way it stands there (conjugated, agreed) – then it is done.
 * About 40 s per word, so 50–60 new words fit in an hour. Without a sentence: faded word, then free.
 */
export function quickLadder(w: TrainerWord): Exercise[] {
  return w.hasCloze ? ['write', 'cloze'] : ['fade', 'write']
}

export type LadderMode = Exercise[] | 'quick'

export function ladderFor(w: TrainerWord, only?: LadderMode): Exercise[] {
  if (only === 'quick') return quickLadder(w)
  if (only) return only
  return (['scramble', w.hasCloze && 'cloze', 'fade', w.canListen && 'listen', 'write', 'final'] as const).filter((x): x is Exercise => !!x)
}

interface WordState { id: string; ladder: Exercise[]; step: number; wrong: number; lastTurn: number }

export interface TrainerItem { id: string; exercise: Exercise; step: number; steps: number }

/** Keeps at least MIN_GAP other turns between two exercises of the same word, when there are enough words. */
const MIN_GAP = 2

export class TrainerEngine {
  private words: WordState[]
  private queue: string[]
  private turn = 0
  readonly done: string[] = []

  constructor(words: TrainerWord[], only?: LadderMode) {
    this.words = words.map((w) => ({ id: w.id, ladder: ladderFor(w, only), step: 0, wrong: 0, lastTurn: -99 }))
    this.queue = words.map((w) => w.id)
  }

  get total() { return this.words.length }
  get finished() { return this.queue.length === 0 }

  /** Progress 0..1 over all rungs of all words. */
  get progress() {
    const all = this.words.reduce((s, w) => s + w.ladder.length, 0)
    const got = this.words.reduce((s, w) => s + w.step, 0)
    return all ? got / all : 1
  }

  wrongCount(id: string) { return this.words.find((w) => w.id === id)?.wrong ?? 0 }

  current(): TrainerItem | null {
    if (!this.queue.length) return null
    const gap = Math.min(MIN_GAP, this.queue.length - 1)
    const pick = this.queue.find((id) => this.turn - this.state(id).lastTurn > gap) ?? this.queue[0]
    const s = this.state(pick)
    return { id: s.id, exercise: s.ladder[s.step], step: s.step, steps: s.ladder.length }
  }

  /** „Kann ich“: the current word is taken out and counts as done. */
  skip(): void {
    const item = this.current()
    if (!item) return
    this.queue = this.queue.filter((id) => id !== item.id)
    this.done.push(item.id)
    this.turn++
  }

  /** Answer the current item. Returns true when the word is now cracked. */
  answer(ok: boolean): boolean {
    const item = this.current()
    if (!item) return false
    const s = this.state(item.id)
    s.lastTurn = this.turn++
    this.queue = this.queue.filter((id) => id !== s.id)
    if (ok) {
      s.step++
      if (s.step >= s.ladder.length) {
        this.done.push(s.id)
        return true
      }
      this.queue.push(s.id)
    } else {
      s.wrong++
      // one rung down (never below the first), and back in a few turns
      s.step = Math.max(0, s.step - 1)
      this.queue.splice(Math.min(this.queue.length, 2), 0, s.id)
    }
    return false
  }

  private state(id: string) { return this.words.find((w) => w.id === id)! }
}

/* ---------- helpers for the exercises ---------- */

/** The form you write: first solution, without explanations in brackets („to target (sth)“ → „to target“). */
export function writtenForm(answer: string): string {
  // brackets first (they may contain „/“ like „(qn/qc)“), then the first of several solutions
  const plain = answer.replace(/\s*\([^)]*\)\s*/g, ' ').split(/;|\s\/\s/)[0].replace(/\s+/g, ' ').trim()
  return plain || (solutions(answer)[0] ?? answer).trim()
}

export interface Tile { id: number; ch: string }

/** Letter tiles for the target (spaces are not tiles), shuffled so it's never already in order. */
export function scrambleTiles(target: string, rng: () => number = Math.random): Tile[] {
  const letters = [...target].filter((c) => c !== ' ').map((ch, id) => ({ id, ch }))
  if (letters.length < 2) return letters
  for (let tries = 0; tries < 10; tries++) {
    const a = letters.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    if (a.map((t) => t.ch).join('') !== letters.map((t) => t.ch).join('')) return a
  }
  return letters.slice().reverse()
}

/** Positions of the spaces in the target, to show the word shape while building it. */
export function spacePositions(target: string): number[] {
  const out: number[] = []
  let k = 0
  for (const c of target) {
    if (c === ' ') out.push(k)
    else k++
  }
  return out
}

/**
 * Faded word: keep the first letter of each word plus every other letter; the rest becomes „_“.
 * Short words (≤ 3 letters) keep only their first letter.
 */
export function fadeWord(target: string): string {
  return target
    .split(' ')
    .map((w) => [...w].map((c, i) => (i === 0 || !/\p{L}/u.test(c) ? c : w.length > 3 && i % 2 === 0 ? c : '_')).join(''))
    .join(' ')
}
