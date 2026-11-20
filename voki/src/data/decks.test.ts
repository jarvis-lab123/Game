import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import catalog from './decks.json'
import { clozeGap } from '../lib/cloze'

describe('built-in Wörtli-Sets', () => {
  for (const d of catalog) {
    const rows = readFileSync(new URL(`./decks/${d.file}`, import.meta.url), 'utf8').trim().split('\n').map((l) => l.split('\t'))
    it(`${d.name}: every row has term and translation, no duplicates`, () => {
      for (const r of rows) expect(r[0] && r[1], r.join(' | ')).toBeTruthy()
      const terms = rows.map((r) => r[0].toLowerCase())
      expect(new Set(terms).size).toBe(terms.length)
    })
    if (d.key === 'franz-berufe-schule')
      it(`${d.name}: the example sentence contains the word (Lückentext)`, () => {
        const missing = rows.filter((r) => r[0] !== 'être (+ Beruf)' && !clozeGap(r[0], r[2])).map((r) => r[0])
        expect(missing).toEqual([])
      })
  }
})
