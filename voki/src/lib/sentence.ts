/**
 * Sentence practice: translate a German sentence into French. A typed sentence that matches the
 * model (ignoring case, punctuation and extra spaces) is right; otherwise the learner sees the
 * model with the missing words marked and decides honestly.
 */
import { stripAccents } from './grade'

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/'/g, "' ")
    .replace(/[.,!?;:«»"()–—-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

/** Same sentence? Case, punctuation and spacing don't matter; accents do. */
export function sameSentence(typed: string, model: string): boolean {
  return words(typed).join(' ') === words(model).join(' ')
}

/** Same apart from accents only? (to tell the learner what is off) */
export function onlyAccents(typed: string, model: string): boolean {
  return !sameSentence(typed, model) && stripAccents(words(typed).join(' ')) === stripAccents(words(model).join(' '))
}

/** The model split into tokens, each marked whether the typed sentence contains that word. */
export function markModel(typed: string, model: string): { text: string; ok: boolean }[] {
  const have = new Map<string, number>()
  for (const w of words(typed)) have.set(w, (have.get(w) ?? 0) + 1)
  return model.split(/(\s+)/).map((tok) => {
    if (!tok.trim()) return { text: tok, ok: true }
    const parts = words(tok)
    const ok = parts.every((p) => {
      const n = have.get(p) ?? 0
      if (n > 0) have.set(p, n - 1)
      return n > 0
    })
    return { text: tok, ok }
  })
}

export interface SentenceQueue { order: string[]; done: string[]; wrong: Record<string, number> }

export function startSentences(ids: string[], rng: () => number = Math.random): SentenceQueue {
  const a = ids.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return { order: a, done: [], wrong: {} }
}

/** Right → done; wrong → comes again 3 sentences later. */
export function markSentence(q: SentenceQueue, ok: boolean): SentenceQueue {
  const [id, ...rest] = q.order
  if (id == null) return q
  if (ok) return { ...q, order: rest, done: [...q.done, id] }
  const order = rest.slice()
  order.splice(Math.min(3, order.length), 0, id)
  return { ...q, order, wrong: { ...q.wrong, [id]: (q.wrong[id] ?? 0) + 1 } }
}
