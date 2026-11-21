import { expect, test } from 'vitest'
import { calculateScore, getRankTitle } from './score'

test.each([
  { correctCount: 79, incorrectCount: 21, passCount: 0, accuracy: 0.79, score: 7480 },
  { correctCount: 4, incorrectCount: 0, passCount: 1, accuracy: 0.8, score: 380 },
  { correctCount: 89, incorrectCount: 11, passCount: 0, accuracy: 0.89, score: 8680 },
  { correctCount: 18, incorrectCount: 1, passCount: 1, accuracy: 0.9, score: 1940 },
  { correctCount: 99, incorrectCount: 0, passCount: 1, accuracy: 0.99, score: 10870 },
  { correctCount: 9, incorrectCount: 0, passCount: 0, accuracy: 1, score: 1080 },
  { correctCount: 0, incorrectCount: 2, passCount: 1, accuracy: 0, score: -60 },
  { correctCount: 0, incorrectCount: 0, passCount: 0, accuracy: 0, score: 0 },
])(
  '正解 $correctCount・不正解 $incorrectCount・パス $passCount の集計',
  ({ correctCount, incorrectCount, passCount, accuracy, score }) => {
    expect(calculateScore({ correctCount, incorrectCount, passCount })).toEqual({
      missCount: incorrectCount + passCount,
      accuracy,
      score,
    })
  },
)

test.each([
  [-60, '電算見習い'],
  [1000, '電算見習い'],
  [1001, '高速の計算士'],
  [3000, '高速の計算士'],
  [3001, '数字の達人'],
  [6000, '数字の達人'],
  [6001, '閃光の計算将軍'],
  [9999, '閃光の計算将軍'],
  [10000, '神速の計算無双'],
])('%i pt の称号は「%s」', (score, title) => {
  expect(getRankTitle(score)).toBe(title)
})
