import { CHARGE_POWER } from './huntConfig'

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
  return CHARGE_POWER.perCorrect * correctCount + CHARGE_POWER.perMaxCombo * maxCombo + CHARGE_POWER.perCritical * criticalCount
}
