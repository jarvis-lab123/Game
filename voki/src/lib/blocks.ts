/**
 * Block learning ("Blocklernen"): a deck is split into blocks of about 50 words.
 * Per block: read through twice, then a handwritten self-check drill (wrong words
 * come back until none are wrong), then a paper test that closes the block with a
 * Swiss grade. When every block has a grade, the worst one comes next.
 */

export const BLOCK_TARGET = 50
export const READ_ROUNDS = 2
/** A block is passed with a 4 or better; below, it has to be done again. */
export const PASS_GRADE = 4
export const passed = (s: { grade: number | null }) => s.grade != null && s.grade >= PASS_GRADE

/** Split into ≈`target`-sized blocks of balanced size, keeping the order. */
export function splitBlocks<T>(items: T[], target = BLOCK_TARGET): T[][] {
  const n = items.length
  if (n === 0) return []
  const k = Math.max(1, Math.round(n / Math.max(1, target)))
  const base = Math.floor(n / k)
  const extra = n % k
  const out: T[][] = []
  let at = 0
  for (let b = 0; b < k; b++) {
    const size = base + (b < extra ? 1 : 0)
    out.push(items.slice(at, at + size))
    at += size
  }
  return out
}

export interface BlockTest { block?: number; blocks?: number; grade: number; date: string }

export interface BlockState {
  index: number
  size: number
  /** latest grade, null if never tested */
  grade: number | null
  best: number | null
  date: string | null
  /** date of the first test of this block */
  first: string | null
  attempts: number
}

/** Grade state per block. Only tests made with the same block split (`blocks === count`) count. */
export function blockStates(sizes: number[], tests: BlockTest[]): BlockState[] {
  const count = sizes.length
  return sizes.map((size, index) => {
    const mine = tests.filter((t) => t.blocks === count && t.block === index).sort((a, b) => a.date.localeCompare(b.date))
    const last = mine[mine.length - 1]
    return {
      index,
      size,
      grade: last ? last.grade : null,
      best: mine.length ? Math.max(...mine.map((t) => t.grade)) : null,
      date: last ? last.date : null,
      first: mine.length ? mine[0].date : null,
      attempts: mine.length,
    }
  })
}

export type NextReason = 'neu' | 'nochmal' | 'schlechteste'

/** First block without a grade; when all have one, the worst latest grade (tie: longest ago). */
export function pickNextBlock(states: BlockState[]): { index: number; reason: NextReason } | null {
  if (states.length === 0) return null
  const open = states.find((s) => !passed(s))
  if (open) return { index: open.index, reason: open.grade == null ? 'neu' : 'nochmal' }
  const worst = states.slice().sort((a, b) => a.grade! - b.grade! || a.date!.localeCompare(b.date!))[0]
  return { index: worst.index, reason: 'schlechteste' }
}

/** Average of the latest block grades, rounded to halves (null if no block has a grade). */
export function overallGrade(states: BlockState[]): number | null {
  const g = states.filter((s) => s.grade != null).map((s) => s.grade!)
  if (!g.length) return null
  return Math.round((g.reduce((a, b) => a + b, 0) / g.length) * 2) / 2
}

/* ---------- handwritten drill: tick off right ones, wrong ones come again ---------- */

export interface DrillState {
  round: number
  /** ids still to ask in this round, in order */
  queue: string[]
  /** wrong in this round → next round */
  wrong: string[]
  /** ticked off (right) */
  done: string[]
  total: number
}

export function startDrill(ids: string[], rng: () => number = Math.random): DrillState {
  return { round: 1, queue: shuffle(ids, rng), wrong: [], done: [], total: ids.length }
}

export function drillCurrent(s: DrillState): string | null {
  return s.queue[0] ?? null
}

export function drillFinished(s: DrillState): boolean {
  return s.queue.length === 0 && s.wrong.length === 0
}

/** Mark the current word. When a round ends, the wrong ones start the next round (shuffled). */
export function drillMark(s: DrillState, ok: boolean, rng: () => number = Math.random): DrillState {
  const id = s.queue[0]
  if (id == null) return s
  const queue = s.queue.slice(1)
  const done = ok ? [...s.done, id] : s.done
  const wrong = ok ? s.wrong : [...s.wrong, id]
  if (queue.length > 0 || wrong.length === 0) return { ...s, queue, wrong, done }
  return { ...s, round: s.round + 1, queue: shuffle(wrong, rng), wrong: [], done }
}

function shuffle<T>(xs: T[], rng: () => number): T[] {
  const a = xs.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ---------- Tagesplan bis zum Test ---------- */

export interface PlanDay { date: string; learn: number[]; done: number[]; finalReview: boolean; today: boolean }

const dayKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Spreads the blocks without a grade over the days until the test: the last day before the test
 * is kept for repeating everything. Blocks first tested today count for today. Returns null when
 * the test is today or over.
 */
export function blockDayPlan(states: BlockState[], now: Date, examDate: string): PlanDay[] | null {
  const [y, m, d] = examDate.split('-').map(Number)
  const days: string[] = []
  for (let i = 0; ; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    if (day.getTime() >= new Date(y, m - 1, d).getTime()) break
    days.push(dayKeyOf(day))
    if (i > 60) break
  }
  if (!days.length) return null
  const today = days[0]
  const learnDays = days.length >= 2 ? days.length - 1 : 1
  const doneToday = states.filter((s) => passed(s) && s.date && dayKeyOf(new Date(s.date)) === today && (!s.first || dayKeyOf(new Date(s.first)) === today)).map((s) => s.index)
  const pending = states.filter((s) => !passed(s)).map((s) => s.index)
  const perDay = Math.ceil((pending.length + doneToday.length) / learnDays)
  const out: PlanDay[] = []
  const todayLearn = pending.slice(0, Math.max(0, perDay - doneToday.length))
  let rest = pending.slice(todayLearn.length)
  out.push({ date: today, learn: todayLearn, done: doneToday, finalReview: learnDays === 1 && days.length === 1, today: true })
  for (let i = 1; i < days.length; i++) {
    const isLast = i === days.length - 1 && days.length >= 2
    const left = learnDays - i
    const take = isLast ? rest.length : left > 0 ? Math.ceil(rest.length / left) : rest.length
    out.push({ date: days[i], learn: rest.slice(0, take), done: [], finalReview: isLast, today: false })
    rest = rest.slice(take)
  }
  return out
}
