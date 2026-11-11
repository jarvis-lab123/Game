import type { VokiDB } from './db'
import type { Card, Deck, Note, ReviewLog, Settings } from '../lib/types'
import { DEFAULT_SETTINGS } from '../lib/types'
import { daysUntil, isExamActive, needsWarning, newPerDay, readiness, type Readiness } from '../lib/exam'
import { boostCandidates, estimateMinutes, isDue, newBudget, BACKLOG_LIMIT } from '../lib/session'

export async function loadSettings(db: VokiDB): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...((await db.settings.get('settings')) ?? {}) }
}

export function startOfDay(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

export interface DeckPlan {
  deck: Deck
  cards: Card[]
  total: number
  due: number
  unlearned: number
  /** Words not yet started (all cards still 'new'). */
  unintroduced: number
  learned: number
  newToday: number
  cram: Card[]
  exam: null | { days: number; perDay: number; warning: boolean; readiness: Readiness }
}

export interface DayPlan {
  decks: DeckPlan[]
  reviews: number
  news: number
  cram: number
  minutes: number
  backlog: boolean
  streak: number
  reviewedToday: number
}

const learnedStage = (c: Card) => c.stage === 'review'

/** Everything the "Heute" screen and the session need, for all (or one) decks. */
export async function planDay(db: VokiDB, now: Date, onlyDeck?: string): Promise<DayPlan> {
  const settings = await loadSettings(db)
  const decks = (await db.decks.toArray()).filter((d) => !d.archived && (!onlyDeck || d.id === onlyDeck))
  const allCards = (await db.cards.toArray()).filter((c) => !c.suspended)
  const since = new Date(startOfDay(now)).toISOString()
  const todayLogs = await db.logs.where('timestamp').aboveOrEqual(since).toArray()
  const reviewedToday = new Set(todayLogs.map((l) => l.cardId))
  const totalDue = allCards.filter((c) => isDue(c, now)).length
  const backlog = totalDue > BACKLOG_LIMIT

  // new cards per deck: budget counts words (notes); both directions of a word come together
  const introNotesToday = new Map<string, Set<string>>()
  const cardById = new Map(allCards.map((c) => [c.id, c]))
  for (const l of todayLogs) {
    if (l.mode !== 'intro') continue
    const c = cardById.get(l.cardId)
    if (!c) continue
    if (!introNotesToday.has(l.deckId)) introNotesToday.set(l.deckId, new Set())
    introNotesToday.get(l.deckId)!.add(c.noteId)
  }
  const introducedNonExam = decks
    .filter((d) => !isExamActive(d, now))
    .reduce((s, d) => s + (introNotesToday.get(d.id)?.size ?? 0), 0)
  let defaultLeft = newBudget({ dueCount: totalDue, defaultLimit: settings.newCardsPerDayDefault, introducedToday: introducedNonExam, examNeed: null })

  const plans: DeckPlan[] = decks.map((deck) => {
    const cards = allCards.filter((c) => c.deckId === deck.id)
    const unlearnedNotes = new Set(cards.filter((c) => !learnedStage(c)).map((c) => c.noteId))
    const started = new Set(cards.filter((c) => c.stage !== 'new').map((c) => c.noteId))
    const unintroduced = [...unlearnedNotes].filter((id) => !started.has(id)).length
    const introduced = introNotesToday.get(deck.id)?.size ?? 0
    let exam: DeckPlan['exam'] = null
    let newToday: number
    let cram: Card[] = []
    if (deck.examDate && isExamActive(deck, now)) {
      const perDay = newPerDay(unintroduced + introduced, deck.examDate, now)
      newToday = Math.min(unintroduced, newBudget({ dueCount: totalDue, defaultLimit: 0, introducedToday: introduced, examNeed: perDay }))
      exam = { days: daysUntil(deck.examDate, now), perDay, warning: needsWarning(perDay), readiness: readiness(cards, deck.examDate, settings.desiredRetention) }
      cram = boostCandidates(cards, deck.examDate, now, settings.desiredRetention, reviewedToday)
    } else {
      newToday = Math.min(unintroduced, defaultLeft)
      defaultLeft -= newToday
    }
    return {
      deck,
      cards,
      total: new Set(cards.map((c) => c.noteId)).size,
      due: cards.filter((c) => isDue(c, now)).length,
      unlearned: unlearnedNotes.size,
      unintroduced,
      learned: cards.filter(learnedStage).length,
      newToday,
      cram,
      exam,
    }
  })
  const reviews = plans.reduce((s, p) => s + p.due, 0)
  const news = plans.reduce((s, p) => s + p.newToday, 0)
  const cram = plans.reduce((s, p) => s + p.cram.length, 0)
  return {
    decks: plans,
    reviews,
    news,
    cram,
    minutes: estimateMinutes(reviews + cram, news),
    backlog,
    streak: await streak(db, now),
    reviewedToday: reviewedToday.size,
  }
}

/** Picks the cards for a session from a plan: due reviews, new words (both directions together), cram. */
export function sessionCards(plan: DayPlan, now: Date): { reviews: Card[]; fresh: Card[]; cram: Card[] } {
  const reviews = plan.decks
    .flatMap((p) => p.cards.filter((c) => isDue(c, now)))
    .sort((a, b) => a.due - b.due)
  // new words: in-progress first, then by import order; decks interleaved round-robin
  const perDeck = plan.decks.map((p) => {
    const byNote = new Map<string, Card[]>()
    const unlearned = p.cards
      .filter((c) => !learnedStage(c))
      .sort((a, b) => Number(b.stage !== 'new') - Number(a.stage !== 'new') || a.order - b.order)
    for (const c of unlearned) {
      if (!byNote.has(c.noteId)) byNote.set(c.noteId, [])
      byNote.get(c.noteId)!.push(c)
    }
    const inProgress = [...byNote.values()].filter((cs) => cs.some((c) => c.stage !== 'new'))
    const fresh = [...byNote.values()].filter((cs) => cs.every((c) => c.stage === 'new'))
    return [...inProgress, ...fresh.slice(0, p.newToday)]
  })
  const fresh: Card[] = []
  for (let i = 0; perDeck.some((l) => i < l.length); i++) for (const l of perDeck) if (l[i]) fresh.push(...l[i])
  return { reviews, fresh, cram: plan.decks.flatMap((p) => p.cram) }
}

/** Consecutive days with at least one review, counting back from today (or yesterday). */
export async function streak(db: VokiDB, now: Date): Promise<number> {
  const logs = await db.logs.orderBy('timestamp').reverse().limit(5000).toArray()
  const days = new Set(logs.map((l) => startOfDay(new Date(l.timestamp))))
  let day = startOfDay(now)
  if (!days.has(day)) day = new Date(day - 86400000).setHours(0, 0, 0, 0)
  let n = 0
  while (days.has(day)) {
    n++
    const d = new Date(day)
    d.setDate(d.getDate() - 1)
    day = d.getTime()
  }
  return n
}

export async function log(db: VokiDB, entry: Omit<ReviewLog, 'id'>): Promise<void> {
  await db.logs.add({ ...entry, id: crypto.randomUUID() })
}

export async function notesById(db: VokiDB, ids: string[]): Promise<Map<string, Note>> {
  const notes = await db.notes.bulkGet(ids)
  return new Map(notes.filter((n): n is Note => !!n).map((n) => [n.id, n]))
}
