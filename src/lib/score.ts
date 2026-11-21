type AnswerCounts = {
  correctCount: number
  incorrectCount: number
  passCount: number
}

export function calculateScore({ correctCount, incorrectCount, passCount }: AnswerCounts) {
  const missCount = incorrectCount + passCount
  const totalCount = correctCount + missCount
  const accuracy = totalCount === 0 ? 0 : correctCount / totalCount

  // 係数を100点に適用して、1.1などの浮動小数点誤差を避ける。
  const pointsPerCorrect = accuracy === 1 ? 120 : accuracy >= 0.9 ? 110 : 100
  const score = correctCount * pointsPerCorrect - missCount * 20

  return { missCount, accuracy, score }
}

export function getRankTitle(score: number) {
  if (score >= 10000) return '神速の計算無双'
  if (score > 6000) return '閃光の計算将軍'
  if (score > 3000) return '数字の達人'
  if (score > 1000) return '高速の計算士'
  return '電算見習い'
}
