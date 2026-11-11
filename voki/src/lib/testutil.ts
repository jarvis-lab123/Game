import { createEmptyCard } from 'ts-fsrs'
import type { Card, Direction, Stage } from './types'

let n = 0
export function mkCard(p: Partial<Card> & { stage?: Stage; direction?: Direction } = {}): Card {
  n++
  const fsrs = createEmptyCard(new Date('2026-11-01T08:00:00'))
  return {
    id: p.id ?? `c${n}`,
    noteId: p.noteId ?? `n${n}`,
    deckId: p.deckId ?? 'd1',
    direction: p.direction ?? 'toTarget',
    stage: p.stage ?? 'new',
    fsrs: p.fsrs ?? fsrs,
    due: p.due ?? Number.MAX_SAFE_INTEGER,
    leech: false,
    suspended: false,
    order: p.order ?? n,
    updatedAt: '',
  }
}
