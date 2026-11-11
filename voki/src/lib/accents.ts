export const ACCENT_BAR = ['é', 'è', 'ê', 'ë', 'à', 'â', 'ç', 'î', 'ï', 'ô', 'û', 'ù', 'œ', 'æ', '«', '»']

const CYCLES = ['eéèêë', 'aàâä', 'cç', 'iîï', 'oôö', 'uûùü', 'yÿ']

/** Next accent variant of a letter (Alt + letter on PC, §5.5), or null. */
export function cycleAccent(ch: string): string | null {
  const lower = ch.toLowerCase()
  const upper = ch !== lower
  for (const cyc of CYCLES) {
    const i = cyc.indexOf(lower)
    if (i >= 0) {
      const next = cyc[(i + 1) % cyc.length]
      return upper ? next.toUpperCase() : next
    }
  }
  return null
}

/** Base letter of an accent variant ("è" -> "e"), or null if the letter has no variants. */
export function baseOf(ch: string): string | null {
  const l = ch.toLowerCase()
  const cyc = CYCLES.find((c) => c.includes(l))
  return cyc ? cyc[0] : null
}
