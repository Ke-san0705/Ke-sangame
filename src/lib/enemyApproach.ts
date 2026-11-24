import type { Level } from './question-generator'
import { COMBO_SPAWN_MULTIPLIERS, ENEMY_DENSITY, ENEMY_DIFFICULTY, ENEMY_SPAWN_ORDER, ENEMY_STAGE, ENEMY_TYPES } from './enemyApproachConfig'

export type Enemy = { id: number; type: keyof typeof ENEMY_TYPES; x: number; hp: number }

export type EnemyApproach = {
  elapsedSeconds: number
  nextEnemyId: number
  spawnProgress: number
  enemies: readonly Enemy[]
}

export function createEnemyApproach(): EnemyApproach {
  return { elapsedSeconds: 0, nextEnemyId: 0, spawnProgress: 0, enemies: [] }
}

function moveEnemies(enemies: readonly Enemy[], seconds: number): Enemy[] {
  let limit = ENEMY_STAGE.contactX
  return enemies.map((enemy) => {
    const x = Math.min(enemy.x, Math.max(limit, enemy.x - ENEMY_TYPES[enemy.type].speed * seconds))
    limit = x + ENEMY_STAGE.spacing
    return { ...enemy, x }
  })
}

export type EnemySpawnOptions = { survival?: boolean; lowPower?: boolean }

const survivalDensity = [...ENEMY_DENSITY.timed, ...ENEMY_DENSITY.survival]

export function advanceEnemies(
  state: EnemyApproach, seconds: number, level: Level, combo: number, options: EnemySpawnOptions = {},
): EnemyApproach {
  const comboMultiplier = COMBO_SPAWN_MULTIPLIERS.reduce((value, entry) => combo >= entry.combo ? entry.multiplier : value, 1)
  const phases = options.survival ? survivalDensity : ENEMY_DENSITY.timed
  const end = state.elapsedSeconds + seconds
  let elapsed = state.elapsedSeconds

  while (elapsed < end) {
    const nextPhase = phases.findIndex(({ fromSeconds }) => fromSeconds > elapsed)
    const phase = phases[nextPhase === -1 ? phases.length - 1 : nextPhase - 1]
    const nextBoundary = phases[nextPhase]?.fromSeconds ?? end
    const stepEnd = Math.min(end, nextBoundary)
    const multiplier = Math.min(comboMultiplier * phase.multiplier, ENEMY_DENSITY.combinedMultiplierCap)
    state = { ...advanceEnemyPhase(state, stepEnd - elapsed, level, multiplier, options.lowPower), elapsedSeconds: stepEnd }
    elapsed = stepEnd
  }
  return state
}

function advanceEnemyPhase(
  state: EnemyApproach, seconds: number, level: Level, multiplier: number, lowPower = false,
): Omit<EnemyApproach, 'elapsedSeconds'> {
  const { baseRate, rateGrowth, maxEnemies } = ENEMY_DIFFICULTY[level]
  const cap = Math.max(1, maxEnemies - (lowPower ? ENEMY_DENSITY.lowPowerCapReduction : 0))
  const growth = rateGrowth * multiplier
  let rate = (baseRate + rateGrowth * state.elapsedSeconds) * multiplier
  let timeLeft = seconds
  let { enemies, nextEnemyId, spawnProgress } = state

  while (enemies.length < cap) {
    const progressNeeded = 1 - spawnProgress
    // Solve the integral of the linear spawn rate for the next spawn time.
    const untilSpawn = 2 * progressNeeded / (rate + Math.sqrt(rate ** 2 + 2 * growth * progressNeeded))
    if (untilSpawn > timeLeft) break
    enemies = moveEnemies(enemies, untilSpawn)
    const id = nextEnemyId++
    const type = ENEMY_SPAWN_ORDER[id % ENEMY_SPAWN_ORDER.length]
    enemies = [...enemies, { id, type, x: ENEMY_STAGE.spawnX, hp: ENEMY_TYPES[type].durability }]
    rate += growth * untilSpawn
    timeLeft -= untilSpawn
    spawnProgress = 0
  }

  return {
    nextEnemyId,
    spawnProgress: enemies.length < cap ? spawnProgress + (rate + growth * timeLeft / 2) * timeLeft : 0,
    enemies: moveEnemies(enemies, timeLeft),
  }
}
