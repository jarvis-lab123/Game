import { describe, expect, it } from 'vitest'
import { CLOZE_ONLY, TrainerEngine, fadeWord, ladderFor, scrambleTiles, spacePositions, writtenForm } from './trainer'

const W = (id: string, hasCloze = true, canListen = true) => ({ id, hasCloze, canListen })

describe('trainer ladder', () => {
  it('new words: quick ladder with two steps', () => {
    expect(ladderFor(W('a'), 'quick')).toEqual(['cloze', 'write'])
    expect(ladderFor(W('a', false), 'quick')).toEqual(['fade', 'write'])
  })
  it('uses cloze and listening only when possible', () => {
    expect(ladderFor(W('a'))).toEqual(['scramble', 'cloze', 'fade', 'listen', 'write', 'final'])
    expect(ladderFor(W('a', false, false))).toEqual(['scramble', 'fade', 'write', 'final'])
  })
})

describe('TrainerEngine', () => {
  it('cloze-only: each word twice as gap sentence', () => {
    const e = new TrainerEngine([W('a'), W('b')], CLOZE_ONLY)
    const seen: string[] = []
    while (!e.finished) { const it = e.current()!; seen.push(`${it.id}:${it.exercise}`); e.answer(true) }
    expect(seen).toEqual(['a:cloze', 'b:cloze', 'a:cloze', 'b:cloze'])
  })
  it('interleaves words and cracks a word after its whole ladder', () => {
    const e = new TrainerEngine([W('a', false, false), W('b', false, false), W('c', false, false)])
    const seen: string[] = []
    while (!e.finished) {
      const it = e.current()!
      seen.push(it.id)
      e.answer(true)
    }
    expect(seen).toHaveLength(12)
    // never the same word twice in a row
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1])
    expect(e.done.sort()).toEqual(['a', 'b', 'c'])
    expect(e.progress).toBe(1)
  })
  it('a mistake sends the word one step down and it comes back', () => {
    const e = new TrainerEngine([W('a', false, false), W('b', false, false), W('c', false, false)])
    expect(e.current()).toMatchObject({ id: 'a', exercise: 'scramble' })
    e.answer(true) // a → fade
    e.answer(true) // b
    e.answer(true) // c
    expect(e.current()).toMatchObject({ id: 'a', exercise: 'fade' })
    e.answer(false)
    expect(e.wrongCount('a')).toBe(1)
    const next: string[] = []
    for (let i = 0; i < 3; i++) { const it = e.current()!; next.push(`${it.id}:${it.exercise}`); e.answer(true) }
    expect(next).toContain('a:scramble')
    expect(next[0]).not.toMatch(/^a:/)
  })
  it('a single word still works (no gap possible)', () => {
    const e = new TrainerEngine([W('a', false, false)])
    let n = 0
    while (!e.finished && n++ < 10) e.answer(true)
    expect(e.done).toEqual(['a'])
  })
})

describe('exercise helpers', () => {
  it('written form drops bracket explanations', () => {
    expect(writtenForm('to target (sth)')).toBe('to target')
    expect(writtenForm('consumer')).toBe('consumer')
  })
  it('scramble keeps all letters, never in order', () => {
    const t = scrambleTiles('critically endangered', () => 0.3)
    expect(t.map((x) => x.ch).sort().join('')).toBe([...'criticallyendangered'].sort().join(''))
    expect(t.map((x) => x.ch).join('')).not.toBe('criticallyendangered')
    expect(spacePositions('critically endangered')).toEqual([10])
  })
  it('fade keeps first letters and every other one', () => {
    expect(fadeWord('unprecedented')).toBe('u_p_e_e_e_t_d')
    expect(fadeWord('to target')).toBe('t_ t_r_e_')
  })
})
