import type { Card as FSRSCard } from 'ts-fsrs'

export type Language = 'en' | 'fr' | 'other'
export type Direction = 'toTarget' | 'toNative'
export type Stage = 'new' | 'intro' | 'mc' | 'type' | 'review'
export type Gender = 'm' | 'f' | 'n' | 'pl'

export interface Deck {
  id: string
  name: string
  language: Language
  examDate?: string // YYYY-MM-DD
  directions: Direction[]
  strictAccents: boolean
  createdAt: string
  archived: boolean
  updatedAt: string
}

export interface Note {
  id: string
  deckId: string
  term: string
  translation: string
  example?: string
  gender?: Gender
  plural?: string
  notes?: string
  mnemonic?: string
  tags: string[]
  updatedAt: string
}

export interface Card {
  id: string
  noteId: string
  deckId: string
  direction: Direction
  stage: Stage
  fsrs: FSRSCard
  /** fsrs.due as epoch ms, for indexing. Infinity-like for unlearned cards. */
  due: number
  leech: boolean
  suspended: boolean
  /** Order within deck, keeps import order for new cards. */
  order: number
  updatedAt: string
}

export type ReviewMode = 'intro' | 'mc' | 'type' | 'flip' | 'cram'

export interface ReviewLog {
  id: string
  cardId: string
  deckId: string
  timestamp: string
  mode: ReviewMode
  rating: number // ts-fsrs Rating (0 = Manual/cram)
  typedAnswer?: string
  correct: boolean
  durationMs: number
}

export interface Settings {
  id: 'settings'
  dailyMinutesGoal: number
  newCardsPerDayDefault: number
  desiredRetention: number
  theme: 'system' | 'light' | 'dark'
  ttsVoiceEn?: string
  ttsVoiceFr?: string
  lastBackupAt?: string
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  dailyMinutesGoal: 15,
  newCardsPerDayDefault: 15,
  desiredRetention: 0.9,
  theme: 'system',
}
