import type { Gender } from './types'
import { normalize } from './grade'

export type Column = 'term' | 'translation' | 'example' | 'gender' | 'notes' | 'ignore'
export const COLUMN_LABELS: Record<Column, string> = {
  term: 'Fremdwort',
  translation: 'Deutsch',
  example: 'Beispielsatz',
  gender: 'Genus',
  notes: 'Notiz',
  ignore: 'Ignorieren',
}

export interface NoteDraft {
  term: string
  translation: string
  example?: string
  gender?: Gender
  notes?: string
  valid: boolean
  duplicate: boolean
}

export const CLAUDE_PROMPT = `Wandle die Vokabelliste auf dem Foto in TSV um (Tab-getrennt), ohne Kopfzeile, eine Vokabel pro Zeile.
Spalten: Fremdwort<TAB>Deutsch<TAB>Beispielsatz<TAB>Genus(m/f/n/pl oder leer)<TAB>Notiz
- Französische Nomen IMMER mit Artikel (le/la/l'/les), bei l' das Genus in Spalte 4.
- Mehrere deutsche Bedeutungen mit ";" trennen.
- Fehlt ein Beispielsatz, schreib einen kurzen, einfachen (max. 8 Wörter).
- Gib NUR die TSV-Zeilen aus, keinen Kommentar.`

function splitLine(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"' && cur.trim() === '') {
      quoted = true
      cur = ''
    } else if (ch === delim) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  out.push(cur.trim())
  return out
}

/** Auto-detects Tab, ";" or "," (in that priority). */
export function parseDelimited(text: string): { delimiter: string; rows: string[][] } {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '')
  const sample = lines.slice(0, 20)
  const count = (d: string) => sample.filter((l) => l.includes(d)).length
  const delimiter = count('\t') > 0 ? '\t' : count(';') >= count(',') && count(';') > 0 ? ';' : count(',') > 0 ? ',' : '\t'
  return { delimiter, rows: lines.map((l) => splitLine(l, delimiter)) }
}

const ORDER: Column[] = ['term', 'translation', 'example', 'gender', 'notes']
export function guessMapping(columns: number): Column[] {
  return Array.from({ length: columns }, (_, i) => ORDER[i] ?? 'ignore')
}

function toGender(v: string): Gender | undefined {
  const s = v.trim().toLowerCase().replace(/\.$/, '')
  if (['m', 'masc', 'masculin', 'männlich'].includes(s)) return 'm'
  if (['f', 'fem', 'féminin', 'feminin', 'weiblich'].includes(s)) return 'f'
  if (['n', 'neutr', 'neutrum', 'sächlich'].includes(s)) return 'n'
  if (['pl', 'plural', 'pluriel'].includes(s)) return 'pl'
  return undefined
}

export function mapRows(rows: string[][], mapping: Column[], existingTerms: Set<string>): NoteDraft[] {
  const seen = new Set(existingTerms)
  return rows.map((row) => {
    const get = (c: Column) => {
      const i = mapping.indexOf(c)
      const v = i >= 0 ? (row[i] ?? '').trim() : ''
      return v || undefined
    }
    const term = get('term') ?? ''
    const translation = get('translation') ?? ''
    const key = normalize(term)
    const duplicate = !!key && seen.has(key)
    if (key) seen.add(key)
    const g = get('gender')
    return {
      term,
      translation,
      example: get('example'),
      gender: g ? toGender(g) : undefined,
      notes: get('notes'),
      valid: !!term && !!translation,
      duplicate,
    }
  })
}
