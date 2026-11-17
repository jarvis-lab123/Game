import { Rating, type Grade } from 'ts-fsrs'
import type { VokiDB } from './db'
import { masteryInfo } from './mastery'
import { loadSettings } from './queries'
import { applyReview } from '../lib/srs'
import type { Card, Deck, Note } from '../lib/types'

export const TRAINER_SIZE = 8
const DAY = 86400000

export interface TrainerPick { note: Note; card: Card; deck: Deck; score: number; reason: string; wrong: number }

/**
 * Words you can't yet, worst first: wrong answers in the last 30 days (block tests and normal
 * tests count double), „wackelt“, still on the ladder. Words that „sitzen“ with no recent mistake
 * are left out. The written direction (German → foreign word) is trained.
 */
export async function trainerCandidates(db: VokiDB, deckId?: string, now = new Date()): Promise<TrainerPick[]> {
  const decks = (await db.decks.toArray()).filter((d) => !d.archived && (!deckId || d.id === deckId))
  const deckById = new Map(decks.map((d) => [d.id, d]))
  const { byNote } = await masteryInfo(db, [...deckById.keys()], now)
  const cards = (await db.cards.where('deckId').anyOf([...deckById.keys()]).toArray()).filter((c) => !c.suspended)
  const notes = new Map((await db.notes.where('deckId').anyOf([...deckById.keys()]).toArray()).map((n) => [n.id, n]))
  const noteOfCard = new Map(cards.map((c) => [c.id, c.noteId]))
  const since = new Date(now.getTime() - 30 * DAY).toISOString()
  const logs = (await db.logs.where('timestamp').aboveOrEqual(since).toArray()).filter((l) => deckById.has(l.deckId) && l.mode !== 'intro')
  const wrong = new Map<string, number>()
  for (const l of logs) {
    if (l.correct) continue
    const n = noteOfCard.get(l.cardId)
    if (n) wrong.set(n, (wrong.get(n) ?? 0) + (l.mode === 'test' ? 2 : 1))
  }
  const out: TrainerPick[] = []
  for (const [noteId, m] of byNote) {
    const note = notes.get(noteId)
    const deck = note && deckById.get(note.deckId)
    if (!note || !deck) continue
    const w = wrong.get(noteId) ?? 0
    if (m === 'neu' || (m === 'sitzt' && w === 0)) continue
    const score = w * 2 + (m === 'wackelt' ? 4 : m === 'lernt' ? 1 : 0) + (note.tags.includes('überschätzt') ? 2 : 0)
    if (score <= 1 && w === 0 && m !== 'wackelt') continue
    const dir = deck.directions.includes('toTarget') ? 'toTarget' : deck.directions[0]
    const card = cards.find((c) => c.noteId === noteId && c.direction === dir) ?? cards.find((c) => c.noteId === noteId)
    if (!card) continue
    out.push({ note, card, deck, score, wrong: w, reason: w > 0 ? `${w}× falsch` : m })
  }
  return out.sort((a, b) => b.score - a.score || a.card.order - b.card.order)
}

/**
 * Words for the gap-sentence mode: the Knacknüsse first, then the other words of the deck that
 * don't sit yet; only words whose example sentence contains the word.
 */
export async function clozeCandidates(db: VokiDB, deckId: string | undefined, hasCloze: (p: TrainerPick) => boolean, now = new Date()): Promise<TrainerPick[]> {
  const hard = (await trainerCandidates(db, deckId, now)).filter(hasCloze)
  const taken = new Set(hard.map((p) => p.note.id))
  const decks = (await db.decks.toArray()).filter((d) => !d.archived && (!deckId || d.id === deckId))
  const deckById = new Map(decks.map((d) => [d.id, d]))
  const { byNote } = await masteryInfo(db, [...deckById.keys()], now)
  const cards = (await db.cards.where('deckId').anyOf([...deckById.keys()]).toArray()).filter((c) => !c.suspended).sort((a, b) => a.order - b.order)
  const notes = new Map((await db.notes.where('deckId').anyOf([...deckById.keys()]).toArray()).map((n) => [n.id, n]))
  const rest: TrainerPick[] = []
  const rank = { wackelt: 0, lernt: 1, neu: 2, sitzt: 3 } as const
  for (const c of cards) {
    const note = notes.get(c.noteId)
    const deck = deckById.get(c.deckId)
    if (!note || !deck || taken.has(note.id)) continue
    const dir = deck.directions.includes('toTarget') ? 'toTarget' : deck.directions[0]
    if (c.direction !== dir) continue
    const m = byNote.get(note.id) ?? 'neu'
    const p: TrainerPick = { note, card: c, deck, score: 0, wrong: 0, reason: m }
    if (hasCloze(p)) { rest.push(p); taken.add(note.id) }
  }
  rest.sort((a, b) => rank[a.reason as keyof typeof rank] - rank[b.reason as keyof typeof rank])
  return [...hard, ...rest]
}

/** Every word answered wrong in the last 30 days, most mistakes first. */
export async function errorCandidates(db: VokiDB, deckId?: string, now = new Date()): Promise<TrainerPick[]> {
  return (await trainerCandidates(db, deckId, now)).filter((p) => p.wrong > 0)
}

/** Words never started yet (all cards „new“), in list order; decks with the nearest test first. */
export async function newCandidates(db: VokiDB, deckId?: string): Promise<TrainerPick[]> {
  const decks = (await db.decks.toArray())
    .filter((d) => !d.archived && (!deckId || d.id === deckId))
    .sort((a, b) => (a.examDate ?? '9999').localeCompare(b.examDate ?? '9999'))
  const out: TrainerPick[] = []
  for (const deck of decks) {
    const cards = (await db.cards.where('deckId').equals(deck.id).toArray()).filter((c) => !c.suspended && deck.directions.includes(c.direction))
    const notes = new Map((await db.notes.where('deckId').equals(deck.id).toArray()).map((n) => [n.id, n]))
    const byNote = new Map<string, Card[]>()
    for (const c of cards) byNote.set(c.noteId, [...(byNote.get(c.noteId) ?? []), c])
    const dir = deck.directions.includes('toTarget') ? 'toTarget' : deck.directions[0]
    const fresh: TrainerPick[] = []
    for (const [noteId, cs] of byNote) {
      const note = notes.get(noteId)
      const card = cs.find((c) => c.direction === dir) ?? cs[0]
      if (!note || !cs.every((c) => c.stage === 'new')) continue
      fresh.push({ note, card, deck, score: 0, wrong: 0, reason: 'neu' })
    }
    out.push(...fresh.sort((a, b) => a.card.order - b.card.order))
  }
  return out
}

/** A word is cracked: the final free recall counts as a review (Hard if it needed several tries). */
export async function crackWord(db: VokiDB, cardId: string, hadMistakes: boolean, now = new Date()): Promise<void> {
  const retention = (await loadSettings(db)).desiredRetention
  const c = await db.cards.get(cardId)
  if (!c) return
  // already reviewed in the last hours: don't push the schedule twice
  const last = c.fsrs.last_review ? new Date(c.fsrs.last_review).getTime() : 0
  if (c.stage === 'review' && now.getTime() - last < 6 * 3600000) return
  await db.cards.put(applyReview(c, (hadMistakes ? Rating.Hard : Rating.Good) as Grade, now, retention))
}
