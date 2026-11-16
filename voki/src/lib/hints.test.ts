import { describe, it, expect } from 'vitest'
import { Rating } from 'ts-fsrs'
import { hintSteps, applyHints } from './hints'

describe('hintSteps (least help first, never the full answer)', () => {
  it('gap sentence, then letter count with article, then first letter', () => {
    expect(hintSteps('la boulangerie', 'Je vais à la boulangerie.')).toEqual([
      'Je vais à la ___.',
      'la _ _ _ _ _ _ _ _ _ _ _',
      'la b _ _ _ _ _ _ _ _ _ _',
    ])
  })
  it('skips the sentence hint when the example does not contain the word', () => {
    expect(hintSteps('to remember', 'I forgot it.')).toEqual(['to _ _ _ _ _ _ _ _', 'to r _ _ _ _ _ _ _'])
  })
  it('keeps elision and spaces of multi-word answers, uses the first solution', () => {
    expect(hintSteps("l'école; la classe")[0]).toBe("l'_ _ _ _ _")
    expect(hintSteps('ice cream')[0]).toBe('_ _ _   _ _ _ _ _')
  })
})

describe('applyHints (§5.4b)', () => {
  it('no hint keeps the rating', () => expect(applyHints(Rating.Good, 0)).toBe(Rating.Good))
  it('one hint: Good becomes Hard', () => expect(applyHints(Rating.Good, 1)).toBe(Rating.Hard))
  it('two or more hints: Again', () => expect(applyHints(Rating.Good, 2)).toBe(Rating.Again))
  it('never improves a rating', () => expect(applyHints(Rating.Again, 1)).toBe(Rating.Again))
})
