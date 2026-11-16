import type { Note } from './types'

/** Tabs/newlines become spaces; a leading quote is escaped so the importer reads it literally. */
function field(v: string | undefined): string {
  const s = (v ?? '').replace(/[\t\r\n]+/g, ' ').trim()
  return s.startsWith('"') ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Voki/Anki TSV: term, translation, example, gender, notes — no header, one note per line.
 * Same column order as Voki's importer and the Claude prompt; Anki maps it to Front/Back(+extra).
 */
export function toTSV(notes: Note[]): string {
  return notes.map((n) => [n.term, n.translation, n.example, n.gender, n.notes].map(field).join('\t') + '\n').join('')
}

/** Loopky card file: front<TAB>back only (its 3rd/4th columns are image URLs, so extras are left out). */
export function toLoopky(notes: Note[]): string {
  return notes.map((n) => `${field(n.term)}\t${field(n.translation)}\n`).join('')
}
