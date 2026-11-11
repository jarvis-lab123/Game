import { describe, it, expect } from 'vitest'
import { parseDelimited, guessMapping, mapRows, CLAUDE_PROMPT } from './tsv'

describe('parseDelimited', () => {
  it('detects tabs and handles CRLF, BOM and blank lines', () => {
    const r = parseDelimited('﻿la maison\tdas Haus\r\n\r\nle chat\tdie Katze\r\n')
    expect(r.delimiter).toBe('\t')
    expect(r.rows).toEqual([['la maison', 'das Haus'], ['le chat', 'die Katze']])
  })
  it('detects semicolons', () => {
    expect(parseDelimited('house;Haus\ncat;Katze').delimiter).toBe(';')
  })
  it('detects commas and respects quotes', () => {
    const r = parseDelimited('big,"groß, hoch"\nsmall,klein')
    expect(r.delimiter).toBe(',')
    expect(r.rows[0]).toEqual(['big', 'groß, hoch'])
  })
  it('prefers tab even when fields contain ; (multiple meanings)', () => {
    const r = parseDelimited('la boulangerie\tdie Bäckerei; der Bäcker')
    expect(r.rows[0]).toEqual(['la boulangerie', 'die Bäckerei; der Bäcker'])
  })
  it('trims cells and unescapes doubled quotes', () => {
    expect(parseDelimited('"say ""hi"""\t  hallo  ').rows[0]).toEqual(['say "hi"', 'hallo'])
  })
})

describe('guessMapping', () => {
  it('uses the Claude prompt column order', () => {
    expect(guessMapping(5)).toEqual(['term', 'translation', 'example', 'gender', 'notes'])
    expect(guessMapping(2)).toEqual(['term', 'translation'])
    expect(guessMapping(7)).toEqual(['term', 'translation', 'example', 'gender', 'notes', 'ignore', 'ignore'])
  })
})

describe('mapRows', () => {
  const mapping = guessMapping(5)
  it('builds drafts with gender normalised', () => {
    const [d] = mapRows([["l'école", 'die Schule', "Je vais à l'école.", 'f', '']], mapping, new Set())
    expect(d).toMatchObject({ term: "l'école", translation: 'die Schule', example: "Je vais à l'école.", gender: 'f', valid: true, duplicate: false })
    expect(d.notes).toBeUndefined()
  })
  it('marks rows without term or translation invalid', () => {
    const ds = mapRows([['la maison', ''], ['', 'Haus']], ['term', 'translation'], new Set())
    expect(ds.map((d) => d.valid)).toEqual([false, false])
  })
  it('marks duplicates against the deck and inside the import', () => {
    const ds = mapRows([['La Maison', 'Haus'], ['le chat', 'Katze'], ['le chat', 'Kater']], ['term', 'translation'], new Set(['la maison']))
    expect(ds.map((d) => d.duplicate)).toEqual([true, false, true])
  })
  it('ignores unknown gender values', () => {
    expect(mapRows([['x', 'y', '', '?', '']], mapping, new Set())[0].gender).toBeUndefined()
  })
})

describe('CLAUDE_PROMPT', () => {
  it('is the prompt from §4.1', () => {
    expect(CLAUDE_PROMPT.startsWith('Wandle die Vokabelliste auf dem Foto in TSV um')).toBe(true)
    expect(CLAUDE_PROMPT).toContain('Gib NUR die TSV-Zeilen aus, keinen Kommentar.')
  })
})
