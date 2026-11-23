import type { Level } from './question-generator'

export const basePointsByLevel = { 1: 100, 2: 130, 3: 170, 4: 220, 5: 280 }

export const missPenalty = 20

type ScoreInput = {
  level: Level
  correctCount: number
  incorrectCount: number
  passCount: number
  maxCombo: number
}

export function calculateScore({ level, correctCount, incorrectCount, passCount, maxCombo }: ScoreInput) {
  const missCount = incorrectCount + passCount
  const totalCount = correctCount + missCount
  const accuracy = totalCount === 0 ? 0 : correctCount / totalCount
  const basePoints = basePointsByLevel[level]
  const accuracyTenths = totalCount === 0 ? 10 : missCount === 0 ? 12 : correctCount * 10 >= totalCount * 9 ? 11 : 10
  const comboTenths = 10 + Math.min(5, Math.floor(maxCombo / 5))

  // Match the ranking RPC: round the correct-answer subtotal to the nearest point.
  const score = Math.floor((correctCount * basePoints * accuracyTenths * comboTenths + 50) / 100)
    - missCount * missPenalty

  return {
    missCount, accuracy, basePoints, score,
    accuracyCoefficient: accuracyTenths / 10,
    comboCoefficient: comboTenths / 10,
  }
}

const ranks = [
  { minimum: -Infinity, title: '電算見習い' },
  { minimum: 500, title: '計算練習生' },
  { minimum: 1000, title: '計算の基礎士' },
  { minimum: 1500, title: '高速の計算士' },
  { minimum: 2000, title: '俊足の計算士' },
  { minimum: 2500, title: '計算の職人' },
  { minimum: 3000, title: '計算の名手' },
  { minimum: 4000, title: '数字の熟練者' },
  { minimum: 5000, title: '数字の達人' },
  { minimum: 6500, title: '計算の師範' },
  { minimum: 8000, title: '暗算の剣豪' },
  { minimum: 10000, title: '閃光の計算将軍' },
  { minimum: 12500, title: '計算の覇者' },
  { minimum: 15000, title: '音速の計算王' },
  { minimum: 20000, title: '神速の計算無双' },
]

export function getRankProgress(score: number) {
  const nextIndex = ranks.findIndex(({ minimum }) => minimum > score)
  if (nextIndex === -1) {
    return { title: ranks[ranks.length - 1].title, pointsToNextRank: null }
  }

  return {
    title: ranks[nextIndex - 1].title,
    pointsToNextRank: ranks[nextIndex].minimum - score,
  }
}
