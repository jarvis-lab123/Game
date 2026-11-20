import { describe, it, expect } from 'vitest'
import { clozeFor, clozeGap, needsOtherForm } from './cloze'

describe('clozeFor (Lückentext)', () => {
  it('replaces the word in the example with a gap', () => {
    expect(clozeFor('unprecedented', 'The fires were on an unprecedented scale.')).toBe('The fires were on an ____ scale.')
  })
  it('finds one form of a masculine/feminine pair', () => {
    expect(clozeGap('un agriculteur, une agricultrice', 'Mon oncle est agriculteur en Suisse.')).toEqual({ sentence: 'Mon oncle est ____ en Suisse.', gap: 'agriculteur' })
    expect(clozeGap('un, une garagiste', 'Le garagiste répare ma voiture.')?.gap).toBe('garagiste')
    expect(clozeGap('un acteur, une actrice', 'Cette actrice joue très bien.')?.gap).toBe('actrice')
  })
  it('phrases: gaps the verb when the sentence fills in the rest', () => {
    expect(clozeGap('apprendre (qc) à (qn)', 'La prof va apprendre le français aux élèves.')?.gap).toBe('apprendre')
  })
  it('uses the given form in the sentence (conjugated)', () => {
    expect(clozeGap('se concentrer', 'Pendant le test, je me concentre bien.', 'me concentre')).toEqual({ sentence: 'Pendant le test, je ____ bien.', gap: 'me concentre' })
    expect(clozeGap('un, une libraire', 'Les libraires conseillent.', 'libraires')?.gap).toBe('libraires')
  })
  it('is case-insensitive', () => {
    expect(clozeFor('non-native', 'Non-native plants can take over.')).toBe('____ plants can take over.')
  })
  it('handles multi-word answers', () => {
    expect(clozeFor('mass extinction', 'Are we living through a mass extinction?')).toBe('Are we living through a ____?')
  })
  it('keeps the whole phrase incl. article if the sentence has it', () => {
    expect(clozeFor('la boulangerie', 'Je vais à la boulangerie.')).toBe('Je vais à ____.')
  })
  it('drops a leading "to"/article when only the rest is in the sentence', () => {
    expect(clozeFor('to face extinction', 'Many frogs face extinction.')).toBe('Many frogs ____.')
  })
  it('uses any accepted solution (";" and optional brackets)', () => {
    expect(clozeFor('loss of (sth)', 'The loss of forests is dramatic.')).toBe('The ____ forests is dramatic.')
    expect(clozeFor('consumer; client', 'The client is king.')).toBe('The ____ is king.')
  })
  it('whole words only', () => {
    expect(clozeFor('cat', 'The category is wrong.')).toBeNull()
    expect(clozeFor('estimated', 'An estimated one million species.')).toBe('An ____ one million species.')
  })
  it('null when the example does not contain the word or is missing', () => {
    expect(clozeFor('to become extinct', 'The dodo became extinct long ago.')).toBeNull()
    expect(clozeFor('degradation')).toBeNull()
    expect(clozeFor('degradation', '')).toBeNull()
  })
  it('works with accents and elision', () => {
    expect(clozeFor("l'école", "Je vais à l'école demain.")).toBe('Je vais à ____ demain.')
    expect(clozeFor('élève', 'Un élève sage.')).toBe('Un ____ sage.')
  })
  it('matches a curly apostrophe in the sentence', () => {
    expect(clozeFor("l'école", 'Je vais à l’école.')).toBe('Je vais à ____.')
  })
  it('only the first occurrence becomes the gap', () => {
    expect(clozeFor('go', 'Go, go, go!')).toBe('____, go, go!')
  })
  it('clozeGap also reports the exact words that were cut out', () => {
    expect(clozeGap('to face extinction', 'Many frogs face extinction.')).toEqual({ sentence: 'Many frogs ____.', gap: 'face extinction' })
    expect(clozeGap('x', 'nothing')).toBeNull()
  })
})

describe('needsOtherForm (Sätze 2.0)', () => {
  it('only words that change in the sentence', () => {
    expect(needsOtherForm('se concentrer', 'me concentre')).toBe(true)
    expect(needsOtherForm('un, une libraire', 'libraires')).toBe(true)
    expect(needsOtherForm('un chantier', 'chantier')).toBe(false)
    expect(needsOtherForm('autoritaire', 'autoritaire')).toBe(false)
    expect(needsOtherForm('un agriculteur, une agricultrice', 'agricultrice')).toBe(false)
  })
})
