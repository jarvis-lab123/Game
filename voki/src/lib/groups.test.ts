import { describe, it, expect } from 'vitest'
import { planGroups, MAX_NEW_PER_GROUP } from './groups'
import { mkCard } from './testutil'

const words = (n: number) => Array.from({ length: n }, (_, i) => [mkCard({ noteId: `w${i}` }), mkCard({ noteId: `w${i}`, direction: 'toNative' })]).flat()
const reviews = (n: number) => Array.from({ length: n }, () => mkCard({ stage: 'review' }))
const notesIn = (cs: { noteId: string }[]) => new Set(cs.map((c) => c.noteId)).size

describe('planGroups – Zeit wählen, in Gruppen einteilen', () => {
  it(`fits new words into the time and never puts more than ${MAX_NEW_PER_GROUP} in a group`, () => {
    const g = planGroups({ reviews: [], fresh: words(20), cram: [] }, 10)
    const total = g.reduce((s, x) => s + notesIn(x.fresh), 0)
    expect(total).toBe(13) // 13 × 45 s ≤ 600 s
    for (const x of g) expect(notesIn(x.fresh)).toBeLessThanOrEqual(MAX_NEW_PER_GROUP)
    expect(g.length).toBe(3)
  })
  it('keeps both directions of a word in the same group', () => {
    const g = planGroups({ reviews: [], fresh: words(6), cram: [] }, 30)
    for (const x of g) for (const c of x.fresh) expect(x.fresh.filter((y) => y.noteId === c.noteId).length).toBe(2)
  })
  it('reviews first when time is short', () => {
    const g = planGroups({ reviews: reviews(40), fresh: words(10), cram: [] }, 5)
    expect(g.reduce((s, x) => s + x.reviews.length, 0)).toBe(30)
    expect(g.reduce((s, x) => s + x.fresh.length, 0)).toBe(0)
  })
  it('always at least one item if anything is there, never empty groups', () => {
    const g = planGroups({ reviews: [], fresh: words(1), cram: [] }, 0)
    expect(g.length).toBe(1)
    expect(g[0].fresh.length).toBe(2)
    expect(planGroups({ reviews: [], fresh: [], cram: [] }, 10)).toEqual([])
  })
  it('reports the estimated seconds per group', () => {
    const g = planGroups({ reviews: reviews(6), fresh: [], cram: [] }, 15)
    expect(g).toHaveLength(1)
    expect(g[0].seconds).toBe(60)
  })
})
