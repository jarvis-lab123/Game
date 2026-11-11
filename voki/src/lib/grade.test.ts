import { describe, it, expect } from 'vitest'
import { Rating } from 'ts-fsrs'
import { normalize, stripAccents, levenshtein, splitArticle, solutions, gradeAnswer, diffChars } from './grade'

describe('normalize', () => {
  it('trims, collapses spaces, lowercases', () => {
    expect(normalize('  La   Boulangerie ')).toBe('la boulangerie')
  })
  it('drops trailing punctuation', () => {
    expect(normalize('bonjour !')).toBe('bonjour')
    expect(normalize('Hello.')).toBe('hello')
  })
  it('unifies typographic apostrophes and removes space after elision', () => {
    expect(normalize('l’école')).toBe("l'école")
    expect(normalize("l' école")).toBe("l'école")
  })
})

describe('stripAccents', () => {
  it('removes French diacritics and ligatures', () => {
    expect(stripAccents('élève à ça où')).toBe('eleve a ca ou')
    expect(stripAccents('cœur')).toBe('coeur')
  })
})

describe('levenshtein', () => {
  it('counts edits', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('house', 'house')).toBe(0)
    expect(levenshtein('', 'abc')).toBe(3)
  })
})

describe('splitArticle', () => {
  it('splits French articles including elision', () => {
    expect(splitArticle('la boulangerie')).toEqual({ article: 'la', rest: 'boulangerie' })
    expect(splitArticle("l'école")).toEqual({ article: "l'", rest: 'école' })
    expect(splitArticle('maison')).toEqual({ article: undefined, rest: 'maison' })
  })
  it('splits English "to" and "the"', () => {
    expect(splitArticle('to remember')).toEqual({ article: 'to', rest: 'remember' })
  })
})

describe('solutions', () => {
  it('splits on semicolon', () => {
    expect(solutions('die Bäckerei; der Bäckerladen')).toEqual(['die Bäckerei', 'der Bäckerladen'])
  })
  it('makes bracketed parts optional', () => {
    expect(solutions('(sich) erinnern')).toEqual(['sich erinnern', 'erinnern'])
  })
  it('ignores empty parts', () => {
    expect(solutions('Haus; ;')).toEqual(['Haus'])
  })
})

const fr = { strictAccents: false, answerLang: 'fr' as const }
describe('gradeAnswer (§5.4)', () => {
  it('exact answer is Good, case and trailing punctuation ignored', () => {
    const r = gradeAnswer('La Boulangerie.', 'la boulangerie', fr)
    expect(r.verdict).toBe('correct')
    expect(r.rating).toBe(Rating.Good)
  })
  it('accepts any of several solutions', () => {
    expect(gradeAnswer('der Bäckerladen', 'die Bäckerei; der Bäckerladen', { strictAccents: false, answerLang: 'de' }).verdict).toBe('correct')
  })
  it('accent-only error is Hard', () => {
    const r = gradeAnswer("l'eleve", "l'élève", fr)
    expect(r.verdict).toBe('accent')
    expect(r.rating).toBe(Rating.Hard)
  })
  it('missing apostrophe counts as accent error', () => {
    expect(gradeAnswer('aujourdhui', "aujourd'hui", fr).verdict).toBe('accent')
  })
  it('accent error with strictAccents is Again', () => {
    const r = gradeAnswer("l'eleve", "l'élève", { ...fr, strictAccents: true })
    expect(r.verdict).toBe('accent')
    expect(r.rating).toBe(Rating.Again)
  })
  it('one typo in a word of >= 6 letters is Hard', () => {
    const r = gradeAnswer('la boulangrie', 'la boulangerie', fr)
    expect(r.verdict).toBe('typo')
    expect(r.rating).toBe(Rating.Hard)
  })
  it('one typo in a short word (< 6 letters) is wrong', () => {
    expect(gradeAnswer('chot', 'chat', fr).verdict).toBe('wrong')
  })
  it('six-letter word with one typo is Hard, five-letter is Again', () => {
    expect(gradeAnswer('maisom', 'maison', fr).verdict).toBe('typo')
    expect(gradeAnswer('tabke', 'table', fr).verdict).toBe('wrong')
  })
  it('wrong French article is Again with article verdict', () => {
    const r = gradeAnswer('le boulangerie', 'la boulangerie', fr)
    expect(r.verdict).toBe('article')
    expect(r.rating).toBe(Rating.Again)
  })
  it('missing French article is Again with article verdict', () => {
    expect(gradeAnswer('boulangerie', 'la boulangerie', fr).verdict).toBe('article')
  })
  it('missing English "to" is Hard, not wrong', () => {
    const r = gradeAnswer('remember', 'to remember', { strictAccents: false, answerLang: 'en' })
    expect(r.verdict).toBe('article')
    expect(r.rating).toBe(Rating.Hard)
  })
  it('missing German article in a translation is fine', () => {
    expect(gradeAnswer('Bäckerei', 'die Bäckerei', { strictAccents: false, answerLang: 'de' }).verdict).toBe('correct')
  })
  it('optional bracket part may be left out', () => {
    expect(gradeAnswer('erinnern', '(sich) erinnern', { strictAccents: false, answerLang: 'de' }).verdict).toBe('correct')
  })
  it('completely different answer is Again', () => {
    const r = gradeAnswer('la voiture', 'la boulangerie', fr)
    expect(r.verdict).toBe('wrong')
    expect(r.rating).toBe(Rating.Again)
  })
  it('empty answer is wrong', () => {
    expect(gradeAnswer('   ', 'la boulangerie', fr).verdict).toBe('wrong')
  })
  it('picks the best verdict over all solutions and reports the matched one', () => {
    const r = gradeAnswer('der Backer', 'die Bäckerei; der Bäcker', { strictAccents: false, answerLang: 'de' })
    expect(r.verdict).toBe('accent')
    expect(r.matched).toBe('der Bäcker')
  })
})

describe('diffChars', () => {
  it('marks wrong/missing letters of the expected answer', () => {
    const d = diffChars('boulangrie', 'boulangerie')
    expect(d.map((x) => x.ch).join('')).toBe('boulangerie')
    expect(d.filter((x) => !x.ok).map((x) => x.ch)).toEqual(['e'])
  })
})
