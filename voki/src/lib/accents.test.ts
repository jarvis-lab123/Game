import { describe, it, expect } from 'vitest'
import { cycleAccent, ACCENT_BAR } from './accents'

describe('cycleAccent (§5.5)', () => {
  it('cycles e -> é -> è -> ê -> ë -> e', () => {
    const seq = ['e']
    for (let i = 0; i < 5; i++) seq.push(cycleAccent(seq[seq.length - 1])!)
    expect(seq).toEqual(['e', 'é', 'è', 'ê', 'ë', 'e'])
  })
  it('handles c and uppercase', () => {
    expect(cycleAccent('c')).toBe('ç')
    expect(cycleAccent('E')).toBe('É')
  })
  it('returns null for letters without variants', () => {
    expect(cycleAccent('x')).toBeNull()
  })
  it('bar has the characters from the spec', () => {
    expect(ACCENT_BAR.join(' ')).toBe('é è ê ë à â ç î ï ô û ù œ æ « »')
  })
})

describe('baseOf', () => {
  it('maps accent variants back to their base letter', async () => {
    const { baseOf } = await import('./accents')
    expect(baseOf('è')).toBe('e')
    expect(baseOf('E')).toBe('e')
    expect(baseOf('Ç')).toBe('c')
    expect(baseOf('x')).toBeNull()
  })
})
