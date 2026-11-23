export const operations = {
  add: { symbol: '＋', label: '足し算' },
  subtract: { symbol: '−', label: '引き算' },
  multiply: { symbol: '×', label: '掛け算' },
  divide: { symbol: '÷', label: '割り算' },
  mix: { symbol: 'MIX', label: 'ミックス' },
} as const

export const levels = {
  1: '初級',
  2: '中級',
  3: '上級',
  4: '超級',
  5: '無双',
} as const

export const durations = [30, 60, 120] as const

export type GameMode = {
  operation: keyof typeof operations
  level: keyof typeof levels
  duration: (typeof durations)[number]
}

export type PlayMode = GameMode | (Omit<GameMode, 'duration'> & { duration: 'survival' })

export const defaultMode: PlayMode = { operation: 'add', level: 1, duration: 60 }
