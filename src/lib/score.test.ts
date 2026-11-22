import { expect, test } from 'vitest'
import { calculateScore, getRankTitle } from './score'

test.each([
  // These cases are also exercised through the RPC in supabase/tests/ranking.sql.
  { level: 1, correctCount: 0, missCount: 0, maxCombo: 0, score: 0 },
  { level: 1, correctCount: 0, missCount: 2, maxCombo: 0, score: -40 },
  { level: 1, correctCount: 9, missCount: 1, maxCombo: 5, score: 1069 },
  { level: 1, correctCount: 10, missCount: 2, maxCombo: 4, score: 960 },
  { level: 2, correctCount: 15, missCount: 1, maxCombo: 9, score: 2340 },
  { level: 2, correctCount: 19, missCount: 2, maxCombo: 9, score: 2949 },
  { level: 3, correctCount: 8, missCount: 1, maxCombo: 5, score: 1476 },
  { level: 4, correctCount: 24, missCount: 0, maxCombo: 24, score: 8870 },
  { level: 5, correctCount: 25, missCount: 0, maxCombo: 25, score: 12600 },
  { level: 5, correctCount: 30, missCount: 0, maxCombo: 30, score: 15120 },
] as const)('Lv.$level 正解 $correctCount・ミス $missCount・最大コンボ $maxCombo のスコア', (entry) => {
  const { level, correctCount, missCount, maxCombo, score } = entry
  expect(calculateScore({ level, correctCount, incorrectCount: missCount, passCount: 0, maxCombo }).score).toBe(score)
})

test.each([
  [-60, '電算見習い'],
  [1499, '電算見習い'],
  [1500, '高速の計算士'],
  [4999, '高速の計算士'],
  [5000, '数字の達人'],
  [9999, '数字の達人'],
  [10000, '閃光の計算将軍'],
  [19999, '閃光の計算将軍'],
  [20000, '神速の計算無双'],
])('%i pt の称号は「%s」', (score, title) => {
  expect(getRankTitle(score)).toBe(title)
})
