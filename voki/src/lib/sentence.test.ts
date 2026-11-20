import { describe, expect, it } from 'vitest'
import { markModel, markSentence, onlyAccents, sameSentence, startSentences } from './sentence'

describe('sentence practice', () => {
  it('same sentence ignores case, punctuation and spaces, not accents', () => {
    expect(sameSentence('en classe nous faisons attention au professeur', 'En classe, nous faisons attention au professeur.')).toBe(true)
    expect(sameSentence("j'aime l’informatique", "J'aime l'informatique.")).toBe(true)
    expect(sameSentence('je me concentre', 'Je me concentre bien.')).toBe(false)
    expect(onlyAccents('elle est tres severe', 'Elle est très sévère.')).toBe(true)
  })
  it('marks the words of the model that are missing', () => {
    const m = markModel('je me concentre', 'Je me concentre bien.')
    expect(m.filter((t) => t.text.trim()).map((t) => [t.text, t.ok])).toEqual([['Je', true], ['me', true], ['concentre', true], ['bien.', false]])
  })
  it('wrong sentences come again until all are right', () => {
    let q = startSentences(['a', 'b'], () => 0.99)
    expect(q.order).toEqual(['a', 'b'])
    q = markSentence(q, false)
    expect(q.order).toEqual(['b', 'a'])
    q = markSentence(q, true)
    q = markSentence(q, true)
    expect(q.order).toEqual([])
    expect(q.done).toEqual(['b', 'a'])
    expect(q.wrong).toEqual({ a: 1 })
  })
})
