import type { Level } from './question-generator'

const basePointsByLevel = { 1: 100, 2: 130, 3: 170, 4: 220, 5: 280 }

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
    - missCount * 20

  return {
    missCount, accuracy, basePoints, score,
    accuracyCoefficient: accuracyTenths / 10,
    comboCoefficient: comboTenths / 10,
  }
}

export function getRankTitle(score: number) {
  if (score >= 20000) return '神速の計算無双'
  if (score >= 10000) return '閃光の計算将軍'
  if (score >= 5000) return '数字の達人'
  if (score >= 1500) return '高速の計算士'
  return '電算見習い'
}
