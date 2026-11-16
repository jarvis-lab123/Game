import { describe, it, expect } from 'vitest'
import { confettiParticles, gradeTone, nextOpen, paperScore, rollSteps } from './papertest'

describe('paperScore', () => {
  it('counts true as 1 point, false as 0, ignores undecided', () => {
    expect(paperScore([true, false, true, null])).toEqual({ points: 2, total: 3, grade: 4.5 })
  })
  it('uses the Swiss grade of decided items', () => {
    expect(paperScore(Array(20).fill(true))).toEqual({ points: 20, total: 20, grade: 6 })
    expect(paperScore([...Array(12).fill(true), ...Array(8).fill(false)]).grade).toBe(4)
    expect(paperScore([...Array(17).fill(true), ...Array(3).fill(false)]).grade).toBe(5.5)
  })
  it('empty or all undecided → grade 1, 0 / 0', () => {
    expect(paperScore([])).toEqual({ points: 0, total: 0, grade: 1 })
    expect(paperScore([null, null])).toEqual({ points: 0, total: 0, grade: 1 })
  })
})

describe('rollSteps', () => {
  it('walks in halves from → to inclusive', () => {
    expect(rollSteps(1, 3, 99)).toEqual([1, 1.5, 2, 2.5, 3])
  })
  it('single value when from === to', () => expect(rollSteps(1, 1, 10)).toEqual([1]))
  it('thins out evenly to at most steps + 1 values, keeping both ends', () => {
    const r = rollSteps(1, 6, 4)
    expect(r.length).toBe(5)
    expect(r[0]).toBe(1)
    expect(r[r.length - 1]).toBe(6)
    for (const v of r) expect(v * 2).toBe(Math.round(v * 2))
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeGreaterThan(r[i - 1])
  })
  it('works downwards too', () => expect(rollSteps(2, 1, 10)).toEqual([2, 1.5, 1]))
  it('snaps odd inputs to halves', () => expect(rollSteps(1, 1.6, 10)).toEqual([1, 1.5]))
})

describe('nextOpen', () => {
  it('finds the first undecided index after a start, wrapping around', () => {
    expect(nextOpen([true, null, false, null], 0)).toBe(1)
    expect(nextOpen([true, null, false, null], 2)).toBe(3)
    expect(nextOpen([null, true, false, true], 2)).toBe(0)
  })
  it('returns -1 when everything is decided', () => expect(nextOpen([true, false], 0)).toBe(-1))
})

describe('gradeTone', () => {
  it('good ≥ 5, warn ≥ 4, bad below', () => {
    expect(gradeTone(6)).toBe('good')
    expect(gradeTone(5)).toBe('good')
    expect(gradeTone(4.5)).toBe('warn')
    expect(gradeTone(4)).toBe('warn')
    expect(gradeTone(3.5)).toBe('bad')
  })
})

describe('confettiParticles', () => {
  it('makes n deterministic particles for a given rng', () => {
    let s = 1
    const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    const a = confettiParticles(40, rng)
    s = 1
    const b = confettiParticles(40, rng)
    expect(a).toHaveLength(40)
    expect(a).toEqual(b)
  })
  it('keeps values in sane ranges', () => {
    for (const p of confettiParticles(40)) {
      expect(['accent', 'good', 'warn']).toContain(p.color)
      expect(['rect', 'circle']).toContain(p.shape)
      expect(p.delay).toBeGreaterThanOrEqual(0)
      expect(p.delay).toBeLessThanOrEqual(0.25)
      expect(p.size).toBeGreaterThanOrEqual(5)
      expect(p.size).toBeLessThanOrEqual(10)
      expect(p.dy).toBeGreaterThan(0) // ends below its peak (gravity)
      expect(p.peak).toBeLessThan(0) // goes up first
    }
  })
})
