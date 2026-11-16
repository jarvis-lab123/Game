import { Rating, type Grade } from 'ts-fsrs'
import { normalize, solutions, splitArticle } from './grade'

const LETTER = /\p{L}/u

function mask(rest: string, revealFirst: boolean): string {
  let first = revealFirst
  return rest
    .split(' ')
    .map((w) =>
      [...w]
        .map((ch) => {
          if (!LETTER.test(ch)) return ch
          if (first) {
            first = false
            return ch
          }
          return '_'
        })
        .join(' '),
    )
    .join('   ')
}

/**
 * Hint ladder §5.4b, ordered from least to most help:
 * 1) example sentence with a gap, 2) letter count + article, 3) first letter.
 * Never reveals the whole answer.
 */
export function hintSteps(answer: string, example?: string): string[] {
  const sol = normalize(solutions(answer)[0] ?? answer)
  const { article, rest } = splitArticle(sol)
  const prefix = article ? (article.endsWith("'") ? article : `${article} `) : ''
  const out: string[] = []
  if (example) {
    const re = new RegExp(rest.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    if (re.test(example)) out.push(example.replace(re, '___'))
  }
  out.push(prefix + mask(rest, false))
  out.push(prefix + mask(rest, true))
  return out
}

/** Each hint lowers the rating: 1 hint → at most Hard, 2+ → Again. */
export function applyHints(rating: Grade, used: number): Grade {
  if (used <= 0) return rating
  if (used === 1) return Math.min(rating, Rating.Hard) as Grade
  return Rating.Again
}
