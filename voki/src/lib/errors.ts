import { gradeAnswer, type AnswerLang, type Verdict } from './grade'

export type ErrorKind = 'nichtGewusst' | 'genus' | 'flüchtig'

/** Classify a wrong typed answer by cause (error-analysis protocol). */
export function classifyError(typed: string | undefined, expected: string, answerLang: AnswerLang): ErrorKind {
  if (!typed || !typed.trim()) return 'nichtGewusst'
  const v: Verdict = gradeAnswer(typed, expected, { strictAccents: true, answerLang }).verdict
  if (v === 'article') return 'genus'
  if (v === 'accent' || v === 'typo' || v === 'correct') return 'flüchtig'
  return 'nichtGewusst'
}

export const ERROR_INFO: Record<ErrorKind, { title: string; tip: string }> = {
  nichtGewusst: { title: 'Nicht gewusst', tip: 'Gedächtnislücke: Bau dir eine Eselsbrücke und üb die Wörter im Drill.' },
  genus: { title: 'Genus / Artikel', tip: 'Regelproblem: Lern das Wort immer mit Artikel. Achte auf die Endungs-Regeln (-tion = la, -ment = le …).' },
  flüchtig: { title: 'Akzente & Tippfehler', tip: 'Flüchtigkeit: Du kennst das Wort. Lies vor dem Prüfen einmal Buchstabe für Buchstabe nach.' },
}
