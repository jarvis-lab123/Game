import { describe, it, expect } from 'vitest'
import { toTSV, toLoopky } from './export'
import { guessMapping, mapRows, parseDelimited } from './tsv'
import type { Note } from './types'

const note = (p: Partial<Note>): Note => ({ id: 'n', deckId: 'd', term: '', translation: '', tags: [], updatedAt: '', ...p })

const notes: Note[] = [
  note({ term: "l'école", translation: 'die Schule', example: "Je vais à l'école.", gender: 'f', notes: 'Merke: l’' }),
  note({ term: 'the house', translation: 'das Haus; das Gebäude' }),
  note({ term: 'les gens', translation: 'die Leute', gender: 'pl' }),
  note({ term: 'big,\tlarge', translation: 'groß\nhoch', example: 'a "big" deal', notes: 'line1\r\nline2' }),
  note({ term: '"quoted"', translation: 'zitiert' }),
]

describe('toTSV', () => {
  it('writes term, translation, example, gender, notes per line, no header', () => {
    expect(toTSV(notes.slice(0, 2))).toBe("l'école\tdie Schule\tJe vais à l'école.\tf\tMerke: l’\nthe house\tdas Haus; das Gebäude\t\t\t\n")
  })
  it('replaces tabs and newlines inside fields with spaces', () => {
    const line = toTSV([notes[3]]).trimEnd()
    expect(line.split('\t')).toEqual(['big, large', 'groß hoch', 'a "big" deal', '', 'line1 line2'])
  })
  it('returns an empty string for no notes', () => {
    expect(toTSV([])).toBe('')
  })
  it('round-trips through the Voki importer', () => {
    const { delimiter, rows } = parseDelimited(toTSV(notes))
    expect(delimiter).toBe('\t')
    const drafts = mapRows(rows, guessMapping(5), new Set())
    expect(drafts).toHaveLength(notes.length)
    drafts.forEach((d, k) => {
      const n = notes[k]
      const clean = (s?: string) => (s ? s.replace(/[\t\r\n]+/g, ' ').trim() || undefined : undefined)
      expect(d.term).toBe(clean(n.term))
      expect(d.translation).toBe(clean(n.translation))
      expect(d.example).toBe(clean(n.example))
      expect(d.gender).toBe(n.gender)
    })
  })
})

describe('toLoopky', () => {
  it('writes front<TAB>back only', () => {
    expect(toLoopky(notes.slice(0, 2))).toBe("l'école\tdie Schule\nthe house\tdas Haus; das Gebäude\n")
    expect(toLoopky([notes[3]]).trimEnd().split('\t')).toEqual(['big, large', 'groß hoch'])
  })
})
