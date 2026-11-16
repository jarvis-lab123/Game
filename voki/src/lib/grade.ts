import { Rating } from 'ts-fsrs'

export type AnswerLang = 'fr' | 'en' | 'de' | 'other'
/** 'spelling': German answer with the right meaning but other spelling (counts as right). 'partial': part of a longer German meaning. */
export type Verdict = 'correct' | 'spelling' | 'accent' | 'typo' | 'article' | 'partial' | 'wrong'

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

const RANK: Record<Verdict, number> = { correct: 0, spelling: 1, accent: 2, typo: 3, article: 4, partial: 5, wrong: 6 }

/* ---------- German answers: meaning over spelling ---------- */
const DE_FILLER = new Set(['der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'etw', 'etwas', 'jmdn', 'jmdm', 'jdn', 'jdm', 'jemanden', 'jemandem', 'sich', 'zu'])

/** Lower-case, umlauts/ß folded (ä = a = ae), punctuation and filler words removed. */
function deWords(s: string): string[] {
  return stripAccents(normalize(s).replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u'))
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !DE_FILLER.has(w))
}

/** How many letters may differ: short words exact, longer words more forgiving. */
function deTolerance(len: number): number {
  return len <= 4 ? 0 : len <= 8 ? 1 : len <= 14 ? 2 : 3
}

function deClose(a: string, e: string): boolean {
  return levenshtein(a, e) <= deTolerance(e.length)
}

function deVerdict(input: string, expected: string): Verdict | null {
  const a = deWords(input)
  const e = deWords(expected)
  if (!a.length || !e.length) return null
  if (deClose(a.join(''), e.join(''))) return 'spelling'
  // part of a longer meaning: every typed word matches a word of the solution
  if (a.length < e.length && a.every((w) => e.some((x) => w.length >= 3 && deClose(w, x)))) return 'partial'
  return null
}

function verdictFor(input: string, expected: string, lang: AnswerLang): Verdict {
  const a = normalize(input)
  const e = normalize(expected)
  if (!a) return 'wrong'
  if (a === e) return 'correct'
  const sa = splitArticle(a)
  const se = splitArticle(e)
  // German answers: article is optional when it is simply left out.
  if (lang === 'de' && !sa.article && se.article && sa.rest === se.rest) return 'correct'
  if (lang === 'de') {
    const v = deVerdict(input, expected)
    if (v) return v
  }
  if (loose(a) === loose(e)) return 'accent'
  if (sa.article !== se.article && loose(sa.rest) === loose(se.rest)) return 'article'
  if (levenshtein(a, e) === 1 && stripAccents(se.rest).replace(/[^a-z]/g, '').length >= 6) return 'typo'
  return 'wrong'
}

function ratingFor(v: Verdict, opts: GradeOptions): Rating {
  switch (v) {
    case 'correct':
    case 'spelling':
      return Rating.Good
    case 'partial':
      return Rating.Hard
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
