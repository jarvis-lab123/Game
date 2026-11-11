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
