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
  /** Visual memory aid (single emoji) */
  emoji?: string
  /** Hand-drawn memory sketch, PNG data URL */
  sketch?: string
  /** Own sentence / mini story */
  story?: string
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

export type ReviewMode = 'intro' | 'mc' | 'type' | 'flip' | 'cram' | 'hand' | 'listen' | 'drill' | 'test'

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

export interface TestItem { cardId: string; typed: string; correct: boolean; confident: boolean }
export interface TestResult {
  id: string
  deckId: string
  date: string
  total: number
  correct: number
  grade: number
  items: TestItem[]
  /** Blocklernen: block index and the number of blocks the deck was split into */
  block?: number
  blocks?: number
  updatedAt: string
}

export type SyncTable = 'decks' | 'notes' | 'cards' | 'logs' | 'tests'
export interface Tombstone { id: string; table: SyncTable; deletedAt: string }

export interface SyncConfig { token: string; gistId: string; lastSyncAt?: string; lastError?: string }

export interface Settings {
  id: 'settings'
  dailyMinutesGoal: number
  newCardsPerDayDefault: number
  desiredRetention: number
  theme: 'system' | 'light' | 'dark'
  ttsVoiceEn?: string
  ttsVoiceFr?: string
  lastBackupAt?: string
  deviceId?: string
  /** Enter fullscreen automatically when a study session starts */
  autoFullscreen?: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  dailyMinutesGoal: 15,
  newCardsPerDayDefault: 15,
  desiredRetention: 0.9,
  theme: 'system',
}
