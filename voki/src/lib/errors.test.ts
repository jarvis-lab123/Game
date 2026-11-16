import { describe, it, expect } from 'vitest'
import { classifyError } from './errors'

describe('classifyError', () => {
  it('article mistake = genus', () => expect(classifyError('le boulangerie', 'la boulangerie', 'fr')).toBe('genus'))
  it('accent or typo = flüchtig', () => {
    expect(classifyError("l'eleve", "l'élève", 'fr')).toBe('flüchtig')
    expect(classifyError('la boulangrie', 'la boulangerie', 'fr')).toBe('flüchtig')
  })
  it('wrong or empty = nicht gewusst', () => {
    expect(classifyError('la voiture', 'la boulangerie', 'fr')).toBe('nichtGewusst')
    expect(classifyError('', 'la boulangerie', 'fr')).toBe('nichtGewusst')
  })
})
