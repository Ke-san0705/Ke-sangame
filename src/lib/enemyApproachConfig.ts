import type { Level } from './question-generator'

// Positions and speeds are fractions of the battle stage width.
export const ENEMY_STAGE = {
  heroX: 0.12,
  contactX: 0.24,
  spawnX: 1.02,
  spacing: 0.075,
  tickMs: 50,
}

export const ENEMY_TYPES = {
  slime: { durability: 1, speed: 0.11, contactDamage: 1, sprite: 'slime' },
  goblin: { durability: 2, speed: 0.16, contactDamage: 2, sprite: 'goblin' },
  wolf: { durability: 2, speed: 0.24, contactDamage: 2, sprite: 'wolf' },
  golem: { durability: 5, speed: 0.09, contactDamage: 3, sprite: 'wood-golem' },
}

export const ENEMY_SPAWN_ORDER = ['slime', 'goblin', 'wolf', 'golem'] as const

// Provisional enemies per second, increase in rate per second, and simultaneous cap.
export const ENEMY_DIFFICULTY: Record<Level, { baseRate: number; rateGrowth: number; maxEnemies: number }> = {
  1: { baseRate: 0.38, rateGrowth: 0.075, maxEnemies: 6 },
  2: { baseRate: 0.51, rateGrowth: 0.085, maxEnemies: 7 },
  3: { baseRate: 0.64, rateGrowth: 0.095, maxEnemies: 8 },
  4: { baseRate: 0.77, rateGrowth: 0.105, maxEnemies: 9 },
  5: { baseRate: 0.90, rateGrowth: 0.115, maxEnemies: 10 },
}

export const COMBO_SPAWN_MULTIPLIERS = [
  { combo: 0, multiplier: 1 },
  { combo: 5, multiplier: 1.5 },
  { combo: 10, multiplier: 2 },
  { combo: 20, multiplier: 3 },
  { combo: 30, multiplier: 4 },
  { combo: 50, multiplier: 5 },
]

export const COMBAT_CONFIG = {
  maxHp: 100,
  incorrectDamage: 10,
  initialAttackStage: 1,
  attackDamage: 1,
}
