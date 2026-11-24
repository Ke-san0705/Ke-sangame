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

export const MAX_ENEMY_SPRITES = Math.max(...Object.values(ENEMY_DIFFICULTY).map(({ maxEnemies }) => maxEnemies))

export const COMBO_SPAWN_MULTIPLIERS = [
  { combo: 0, multiplier: 1 },
  { combo: 5, multiplier: 1.5 },
  { combo: 10, multiplier: 2 },
  { combo: 20, multiplier: 3 },
  { combo: 30, multiplier: 4 },
  { combo: 50, multiplier: 5 },
]

export const ATTACK_STAGES = [
  { combo: 0, stage: 1, targets: 1, name: '通常斬撃', effect: 'slash' },
  { combo: 5, stage: 2, targets: 2, name: '飛翔斬撃', effect: 'flying' },
  { combo: 10, stage: 3, targets: 4, name: '衝撃波・弱', effect: 'shockwave' },
  { combo: 20, stage: 4, targets: 8, name: '衝撃波・強', effect: 'shockwave' },
  { combo: 30, stage: 5, targets: 16, name: 'エネルギー砲・弱', effect: 'cannon' },
  { combo: 50, stage: 6, targets: 32, name: 'エネルギー砲・強', effect: 'cannon' },
] as const

export const COMBAT_CONFIG = {
  maxHp: 100,
  incorrectDamage: 10,
  initialAttackStage: ATTACK_STAGES[0].stage,
  attackDamage: 1,
}

// Forward range is expressed as a fraction of the stage width from the hero.
export const COMBO_SPECIAL = {
  interval: 10,
  heal: 10,
  damage: 3,
  range: 0.72,
  maxTargets: 8,
}
