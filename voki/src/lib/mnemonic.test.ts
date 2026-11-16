import { describe, it, expect } from 'vitest'
import { suggestMnemonics } from './mnemonic'

const n = (term: string, translation: string, extra = {}) => ({ id: term, deckId: 'd', term, translation, tags: [], updatedAt: '', ...extra })

describe('suggestMnemonics – Eselsbrücken-Werkstatt', () => {
  it('French gender rule for -tion', () => {
    const s = suggestMnemonics(n('la nation', 'die Nation'), 'fr', [])
    expect(s.some((x) => x.kind === 'genus' && x.text.includes('-tion'))).toBe(true)
  })
  it('no masculine -age rule for the exceptions like la plage', () => {
    expect(suggestMnemonics(n('la plage', 'der Strand'), 'fr', []).some((x) => x.kind === 'genus')).toBe(false)
  })
  it('word part -erie = shop', () => {
    expect(suggestMnemonics(n('la boulangerie', 'die Bäckerei'), 'fr', []).some((x) => x.kind === 'wortteil' && x.text.includes('-erie'))).toBe(true)
  })
  it('English -less', () => {
    expect(suggestMnemonics(n('careless', 'unvorsichtig'), 'en', []).some((x) => x.text.includes('-less'))).toBe(true)
  })
  it('finds the German look-alike', () => {
    expect(suggestMnemonics(n('le restaurant', 'das Restaurant'), 'fr', []).some((x) => x.kind === 'ähnlich')).toBe(false) // identical = no help needed
    expect(suggestMnemonics(n('la musique', 'die Musik'), 'fr', []).some((x) => x.kind === 'ähnlich' && x.text.includes('Musik'))).toBe(true)
  })
  it('finds an English look-alike from another deck', () => {
    const s = suggestMnemonics(n('la question', 'die Frage'), 'fr', [n('question', 'die Frage', { deckId: 'en' })])
    expect(s.some((x) => x.kind === 'ähnlich' && x.text.includes('question'))).toBe(true)
  })
})
