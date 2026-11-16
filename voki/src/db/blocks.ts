import { Rating } from 'ts-fsrs'
import type { VokiDB } from './db'
import type { Card } from '../lib/types'
import { applyReview } from '../lib/srs'

const LADDER = new Set<Card['stage']>(['new', 'intro', 'mc', 'type'])

/** After reading a block twice: its new words (and their new sibling cards) count as introduced. */
export async function introduceBlock(db: VokiDB, cardIds: string[], now = new Date()): Promise<void> {
  const iso = now.toISOString()
  await db.transaction('rw', db.cards, async () => {
    const cards = (await db.cards.bulkGet(cardIds)).filter((c): c is Card => !!c)
    const noteIds = [...new Set(cards.map((c) => c.noteId))]
    const all = await db.cards.where('noteId').anyOf(noteIds).toArray()
    const fresh = all.filter((c) => c.stage === 'new' || c.stage === 'intro')
    if (fresh.length) await db.cards.bulkPut(fresh.map((c) => ({ ...c, stage: 'mc' as const, updatedAt: iso })))
  })
}

/**
 * The block test is a clean recall on paper, so it feeds the learning progress:
 * right → the word is learned (FSRS „Good“; words still on the ladder graduate, and so does a
 * not-yet-learned sibling card – who can write it can recognise it); wrong → FSRS „Again“ for
 * learned cards, ladder cards stay to be learned.
 */
export async function applyBlockTest(db: VokiDB, results: { cardId: string; correct: boolean }[], retention: number, now = new Date()): Promise<void> {
  const iso = now.toISOString()
  await db.transaction('rw', db.cards, async () => {
    const cards = new Map((await db.cards.bulkGet(results.map((r) => r.cardId))).filter((c): c is Card => !!c).map((c) => [c.id, c]))
    const out: Card[] = []
    for (const r of results) {
      const c = cards.get(r.cardId)
      if (!c) continue
      const siblings = (await db.cards.where('noteId').equals(c.noteId).toArray()).filter((s) => s.id !== c.id && !s.suspended)
      if (r.correct) {
        out.push(applyReview(c, Rating.Good, now, retention))
        for (const s of siblings) if (LADDER.has(s.stage)) out.push(applyReview(s, Rating.Good, now, retention))
      } else {
        out.push(c.stage === 'review' ? applyReview(c, Rating.Again, now, retention) : { ...c, stage: 'type', updatedAt: iso })
        for (const s of siblings) if (s.stage === 'new' || s.stage === 'intro') out.push({ ...s, stage: 'mc', updatedAt: iso })
      }
    }
    if (out.length) await db.cards.bulkPut(out)
  })
}
