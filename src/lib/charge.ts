type ChargeCounts = {
  correctCount: number
  maxCombo: number
  criticalCount: number
}

export type ChargeResult = {
  power: number
  criticalCount: number
}

export function calculateCharge({ correctCount, maxCombo, criticalCount }: ChargeCounts) {
  return 10 * correctCount + 5 * maxCombo + 8 * criticalCount
}
