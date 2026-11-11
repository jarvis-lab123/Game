import { Rating } from 'ts-fsrs'

export type AnswerLang = 'fr' | 'en' | 'de' | 'other'
export type Verdict = 'correct' | 'accent' | 'typo' | 'article' | 'wrong'

export interface GradeOptions {
  strictAccents: boolean
  /** Language of the expected answer (decides how article mistakes count). */
  answerLang: AnswerLang
}

export interface GradeResult {
  verdict: Verdict
  rating: Rating
  /** The accepted solution closest to the input. */
  matched: string
}

/** Trim, collapse whitespace, lowercase, unify apostrophes, drop trailing punctuation. */
export function normalize(s: string): string {
  return s
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s.!?,;:…]+$/u, '')
    .replace(/'\s+/g, "'")
}

const LIGATURES: Record<string, string> = { œ: 'oe', æ: 'ae', ß: 'ss' }

export function stripAccents(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[œæß]/g, (c) => LIGATURES[c])
}

/** Accent-, apostrophe- and hyphen-insensitive form. */
function loose(s: string): string {
  return stripAccents(s).replace(/['\-]/g, '').replace(/\s+/g, '')
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

const ARTICLES = ['les', 'le', 'la', 'un', 'une', 'des', 'du', 'the', 'an', 'a', 'to', 'der', 'die', 'das', 'ein', 'eine']

/** Split a leading article (le/la/l'/les/un/une, the/a/an/to, der/die/das …). Input should be normalized. */
export function splitArticle(s: string): { article: string | undefined; rest: string } {
  const m = /^(l'|[a-z]+ )(.+)$/i.exec(s)
  if (m) {
    const art = m[1].trim()
    if (art === "l'" || ARTICLES.includes(art)) return { article: art, rest: m[2] }
  }
  return { article: undefined, rest: s }
}

/** All accepted solutions: split on ";", bracketed parts optional. */
export function solutions(answer: string): string[] {
  const out: string[] = []
  for (const part of answer.split(';')) {
    const p = part.replace(/\s+/g, ' ').trim()
    if (!p) continue
    const groups = (p.match(/\(.*?\)/g) ?? []).slice(0, 4)
    // every combination of keeping / dropping each bracket group, "all kept" first
    for (let mask = (1 << groups.length) - 1; mask >= 0; mask--) {
      let i = 0
      const v = p.replace(/\(.*?\)/g, (g) => {
        const keep = i < groups.length ? (mask >> (groups.length - 1 - i)) & 1 : 1
        i++
        return keep ? g.slice(1, -1) : ''
      })
      out.push(v.replace(/\s+/g, ' ').trim())
    }
  }
  return [...new Set(out.filter(Boolean))]
}

const RANK: Record<Verdict, number> = { correct: 0, accent: 1, typo: 2, article: 3, wrong: 4 }

function verdictFor(input: string, expected: string, lang: AnswerLang): Verdict {
  const a = normalize(input)
  const e = normalize(expected)
  if (!a) return 'wrong'
  if (a === e) return 'correct'
  const sa = splitArticle(a)
  const se = splitArticle(e)
  // German answers: article is optional when it is simply left out.
  if (lang === 'de' && !sa.article && se.article && sa.rest === se.rest) return 'correct'
  if (loose(a) === loose(e)) return 'accent'
  if (sa.article !== se.article && loose(sa.rest) === loose(se.rest)) return 'article'
  if (levenshtein(a, e) === 1 && stripAccents(se.rest).replace(/[^a-z]/g, '').length >= 6) return 'typo'
  return 'wrong'
}

function ratingFor(v: Verdict, opts: GradeOptions): Rating {
  switch (v) {
    case 'correct':
      return Rating.Good
    case 'accent':
      return opts.strictAccents ? Rating.Again : Rating.Hard
    case 'typo':
      return Rating.Hard
    case 'article':
      return opts.answerLang === 'fr' ? Rating.Again : Rating.Hard
    default:
      return Rating.Again
  }
}

export function gradeAnswer(input: string, expected: string, opts: GradeOptions): GradeResult {
  const sols = solutions(expected)
  let best: { verdict: Verdict; matched: string } = { verdict: 'wrong', matched: sols[0] ?? expected }
  for (const s of sols) {
    const v = verdictFor(input, s, opts.answerLang)
    if (RANK[v] < RANK[best.verdict]) best = { verdict: v, matched: s }
  }
  if (best.verdict === 'wrong') {
    // show the solution closest to what was typed
    const n = normalize(input)
    best.matched = [...sols].sort((x, y) => levenshtein(n, normalize(x)) - levenshtein(n, normalize(y)))[0] ?? expected
  }
  return { ...best, rating: ratingFor(best.verdict, opts) }
}

/** Per character of `expected`: was it matched by the input (LCS)? */
export function diffChars(input: string, expected: string): { ch: string; ok: boolean }[] {
  const a = [...input.toLowerCase()]
  const eChars = [...expected]
  const e = eChars.map((c) => c.toLowerCase())
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(e.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = e.length - 1; j >= 0; j--)
      dp[i][j] = a[i] === e[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const ok = new Array<boolean>(e.length).fill(false)
  let i = 0
  let j = 0
  while (i < a.length && j < e.length) {
    if (a[i] === e[j]) {
      ok[j] = true
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else j++
  }
  return eChars.map((ch, k) => ({ ch, ok: ok[k] || ch === ' ' }))
}
