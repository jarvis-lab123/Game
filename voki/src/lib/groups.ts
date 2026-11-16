import type { Card } from './types'

export const MAX_NEW_PER_GROUP = 5
export const GROUP_SECONDS = 300
const SEC_REVIEW = 10
const SEC_WORD = 45
/** Not-Modus: cloze + recheck add about two answers per word */
const SEC_WORD_CRUNCH = 75

export interface Group { reviews: Card[]; fresh: Card[]; cram: Card[]; seconds: number }

function byNote(cards: Card[]): Card[][] {
  const m = new Map<string, Card[]>()
  for (const c of cards) m.set(c.noteId, [...(m.get(c.noteId) ?? []), c])
  return [...m.values()]
}

function split<T>(items: T[], parts: number): T[][] {
  const out: T[][] = []
  let i = 0
  for (let p = 0; p < parts; p++) {
    const size = Math.floor(items.length / parts) + (p < items.length % parts ? 1 : 0)
    out.push(items.slice(i, i + size))
    i += size
  }
  return out
}

/**
 * Fits the chosen time (reviews first, then new words, then extra exam practice)
 * and splits it into short groups of at most 5 new words (chunking).
 */
export function planGroups(input: { reviews: Card[]; fresh: Card[]; cram: Card[] }, minutes: number, opts: { crunch?: boolean } = {}): Group[] {
  const secWord = opts.crunch ? SEC_WORD_CRUNCH : SEC_WORD
  const budget = Math.max(0, minutes) * 60
  let used = 0
  const take = <T>(list: T[], cost: number): T[] => {
    const out: T[] = []
    for (const x of list) {
      if (used + cost > budget && used > 0) break
      if (used + cost > budget && used === 0 && out.length === 0) {
        out.push(x) // always at least one item
        used += cost
        break
      }
      out.push(x)
      used += cost
    }
    return out
  }
  const reviews = take(input.reviews, SEC_REVIEW)
  const words = take(byNote(input.fresh), secWord)
  const cram = take(input.cram, SEC_REVIEW)
  if (!reviews.length && !words.length && !cram.length) return []
  const n = Math.max(1, Math.ceil(used / GROUP_SECONDS), Math.ceil(words.length / MAX_NEW_PER_GROUP))
  const r = split(reviews, n)
  const w = split(words, n)
  const k = split(cram, n)
  return r
    .map((rv, i) => ({
      reviews: rv,
      fresh: w[i].flat(),
      cram: k[i],
      seconds: rv.length * SEC_REVIEW + w[i].length * secWord + k[i].length * SEC_REVIEW,
    }))
    .filter((g) => g.reviews.length + g.fresh.length + g.cram.length > 0)
}
