import type { Gender, Language, Note } from './types'
import { levenshtein, normalize, splitArticle, stripAccents } from './grade'

export type SuggestionKind = 'genus' | 'wortteil' | 'ähnlich'
export interface Suggestion { kind: SuggestionKind; text: string }

const FR_GENDER_RULES: { suffix: string; gender: 'm' | 'f'; text: string; except: string[] }[] = [
  { suffix: 'tion', gender: 'f', text: 'Wörter auf -tion sind weiblich (la nation, la station).', except: [] },
  { suffix: 'sion', gender: 'f', text: 'Wörter auf -sion sind weiblich (la télévision).', except: [] },
  { suffix: 'té', gender: 'f', text: 'Wörter auf -té sind meist weiblich (la liberté, la santé).', except: ['été', 'côté', 'pâté'] },
  { suffix: 'ette', gender: 'f', text: 'Wörter auf -ette sind weiblich (la baguette).', except: ['squelette'] },
  { suffix: 'ure', gender: 'f', text: 'Wörter auf -ure sind meist weiblich (la voiture).', except: ['murmure'] },
  { suffix: 'ence', gender: 'f', text: 'Wörter auf -ence sind weiblich (la différence).', except: ['silence'] },
  { suffix: 'ance', gender: 'f', text: 'Wörter auf -ance sind weiblich (la chance).', except: [] },
  { suffix: 'ment', gender: 'm', text: 'Nomen auf -ment sind männlich (le moment).', except: [] },
  { suffix: 'age', gender: 'm', text: 'Wörter auf -age sind meist männlich (le fromage).', except: ['plage', 'page', 'image', 'cage', 'rage', 'nage'] },
  { suffix: 'eau', gender: 'm', text: 'Wörter auf -eau sind meist männlich (le bateau).', except: ['eau', 'peau'] },
  { suffix: 'isme', gender: 'm', text: 'Wörter auf -isme sind männlich (le tourisme).', except: [] },
  { suffix: 'oir', gender: 'm', text: 'Wörter auf -oir sind männlich (le miroir).', except: [] },
]

const WORD_PARTS: Record<string, { test: (w: string) => boolean; text: string }[]> = {
  fr: [
    { test: (w) => w.endsWith('erie') && w.length > 6, text: '-erie steht oft für einen Laden (la boucherie = Metzgerei, la pâtisserie = Konditorei).' },
    { test: (w) => /eur$|euse$/.test(w) && w.length > 5, text: '-eur / -euse = Person, die etwas tut (le chanteur = der Sänger).' },
    { test: (w) => w.endsWith('ment') && w.length > 6, text: '-ment am Adjektiv = deutsches -lich / -weise (lentement = langsam).' },
    { test: (w) => w.endsWith('able') && w.length > 6, text: '-able = -bar (faisable = machbar).' },
  ],
  en: [
    { test: (w) => w.endsWith('less') && w.length > 5, text: '-less = -los (careless = sorglos, homeless = obdachlos).' },
    { test: (w) => w.endsWith('ful') && w.length > 5, text: '-ful = -voll (careful = sorgfältig, „voller Sorge“).' },
    { test: (w) => w.endsWith('ness') && w.length > 6, text: '-ness = -heit / -keit (kindness = Freundlichkeit).' },
    { test: (w) => w.startsWith('un') && w.length >= 7 && !w.startsWith('under') && !w.startsWith('uni'), text: 'un- = un- (unhappy = unglücklich).' },
    { test: (w) => w.endsWith('ly') && w.length > 5, text: '-ly macht aus dem Adjektiv ein Adverb (quick → quickly).' },
  ],
}

function genderOf(note: Note, article?: string): Gender | undefined {
  if (article === 'le') return 'm'
  if (article === 'la') return 'f'
  if (article === 'les') return 'pl'
  return note.gender
}

function core(s: string): string {
  return stripAccents(splitArticle(normalize(s)).rest).replace(/[^a-z]/g, '')
}

function similar(a: string, b: string): boolean {
  if (a.length < 4 || b.length < 4) return false
  let prefix = 0
  while (prefix < Math.min(a.length, b.length) && a[prefix] === b[prefix]) prefix++
  return prefix >= 4 || 1 - levenshtein(a, b) / Math.max(a.length, b.length) >= 0.7
}

/** Automatic memory hooks: gender rules, word parts, look-alike words in German or your other decks. */
export function suggestMnemonics(note: Note, language: Language, others: Note[]): Suggestion[] {
  const out: Suggestion[] = []
  const { article, rest } = splitArticle(normalize(note.term))
  const word = rest.split(' ').pop() ?? rest
  if (language === 'fr') {
    const g = genderOf(note, article)
    for (const r of FR_GENDER_RULES) {
      if (!word.endsWith(r.suffix) || r.except.includes(stripAccents(word)) || r.except.includes(word)) continue
      if (!g || g === r.gender) out.push({ kind: 'genus', text: r.text })
      else out.push({ kind: 'genus', text: `Ausnahme! ${r.text.split(' (')[0]} – „${note.term}“ aber nicht.` })
      break
    }
  }
  for (const p of WORD_PARTS[language] ?? []) if (p.test(word)) out.push({ kind: 'wortteil', text: p.text })

  const me = core(note.term)
  for (const t of note.translation.split(/[;,]/)) {
    const de = core(t)
    if (de && de !== me && similar(me, de)) {
      out.push({ kind: 'ähnlich', text: `Klingt wie „${t.trim()}“ – merk dir den Unterschied in der Schreibweise.` })
      break
    }
  }
  for (const o of others) {
    if (o.id === note.id || o.deckId === note.deckId) continue
    const c = core(o.term)
    if (c && similar(me, c)) {
      out.push({ kind: 'ähnlich', text: `Wie „${o.term}“ aus deinem anderen Deck (${o.translation}).` })
      break
    }
  }
  return out
}
