export const CHARGE_POWER = {
  perCorrect: 10,
  perMaxCombo: 5,
  perCritical: 8,
} as const

export const HUNT_TIMING = {
  finishDisplayMs: 800,
  criticalWindowMs: { 1: 3_000, 2: 4_000, 3: 5_000, 4: 7_000, 5: 10_000 },
  survivalBonus: [
    { fromCorrect: 60, bonusMs: 0 },
    { fromCorrect: 30, bonusMs: 1_000 },
    { fromCorrect: 0, bonusMs: 2_000 },
  ],
} as const

export const CHARGE_COLORS = [
  { fromCorrect: 15, color: 'black' },
  { fromCorrect: 9, color: 'red' },
  { fromCorrect: 4, color: 'yellow' },
  { fromCorrect: 0, color: 'blue' },
] as const
