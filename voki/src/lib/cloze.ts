import { normalize, solutions, splitArticle } from './grade'

export const GAP = '____'

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const wholeWord = (s: string) => new RegExp(`(?<![\\p{L}\\p{N}])${esc(s).replace(/ /g, '\\s+').replace(/'/g, "['’‘]")}(?![\\p{L}\\p{N}])`, 'iu')

/** Gap sentence plus the exact words cut out of the example (whole words, case-insensitive). */
export function clozeGap(answer: string, example?: string, gap?: string): { sentence: string; gap: string } | null {
  if (!example?.trim()) return null
  // the exact form given for the sentence (conjugated, agreed: „je me concentre“) comes first
  if (gap?.trim()) {
    const m = wholeWord(normalize(gap)).exec(example)
    if (m) return { sentence: example.slice(0, m.index) + GAP + example.slice(m.index + m[0].length), gap: m[0] }
  }
  // longest candidates first: "la boulangerie" before "boulangerie"
  const cands = new Set<string>()
  const add = (x: string) => {
    const n = normalize(x)
    if (!n) return
    cands.add(n)
    const { article, rest } = splitArticle(n)
    if (article) cands.add(rest)
  }
  for (const s of solutions(answer)) {
    add(s)
    // masculine and feminine form: „un agriculteur, une agricultrice“ → each form on its own
    if (s.includes(',')) for (const part of s.split(',')) if (!/^(un|une|le|la|les|l')$/i.test(part.trim())) add(part)
  }
  for (const c of [...cands].filter((c) => /\p{L}/u.test(c)).sort((a, b) => b.length - a.length)) {
    const m = wholeWord(c).exec(example)
    if (m) return { sentence: example.slice(0, m.index) + GAP + example.slice(m.index + m[0].length), gap: m[0] }
  }
  // phrases like „apprendre (qc) à (qn)“: gap the verb if the sentence uses it with other words
  for (const c of cands) {
    const first = c.split(' ')[0]
    if (c.includes(' ') && first.length >= 5) {
      const m = wholeWord(first).exec(example)
      if (m) return { sentence: example.slice(0, m.index) + GAP + example.slice(m.index + m[0].length), gap: m[0] }
    }
  }
  return null
}

/** Example sentence with the answer's word(s) replaced by "____"; null if the example doesn't contain it. */
export function clozeFor(answer: string, example?: string): string | null {
  return clozeGap(answer, example)?.sentence ?? null
}

/** Does the sentence need another form than the word in the list (conjugated, plural, feminine …)? */
export function needsOtherForm(answer: string, gap?: string): boolean {
  if (!gap?.trim()) return false
  const g = normalize(gap)
  const forms = new Set<string>()
  for (const s of solutions(answer))
    for (const part of [s, ...s.split(',')]) {
      const n = normalize(part)
      forms.add(n)
      forms.add(splitArticle(n).rest)
    }
  return !forms.has(g)
}
