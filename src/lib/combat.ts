import { advanceEnemies, createEnemyApproach, type Enemy, type EnemyApproach, type EnemySpawnOptions } from './enemyApproach'
import { ATTACK_STAGES, COMBAT_CONFIG, ENEMY_STAGE, ENEMY_TYPES } from './enemyApproachConfig'
import type { Level } from './question-generator'

export type EnemyHit = { enemy: Enemy; defeated: boolean }

type Combat = EnemyApproach & {
  hp: number
  combo: number
  attackStage: number
  defeated: number
  lastHits: readonly EnemyHit[]
  phase: 'playing' | 'defeat' | 'special'
}

export function createCombat(): Combat {
  return {
    ...createEnemyApproach(),
    hp: COMBAT_CONFIG.maxHp,
    combo: 0,
    attackStage: COMBAT_CONFIG.initialAttackStage,
    defeated: 0,
    lastHits: [],
    phase: 'playing',
  }
}

export function damageCombat(state: Combat, damage: number): Combat {
  if (state.phase !== 'playing') return state
  const hp = Math.max(0, Math.min(COMBAT_CONFIG.maxHp, state.hp - damage))
  return { ...state, hp, phase: hp === 0 ? 'defeat' : 'playing' }
}

export function selectAttackTargets(enemies: Combat['enemies'], limit: number) {
  return [...enemies].sort((a, b) => a.x - b.x).slice(0, limit)
}

export function applyCombatAnswer(state: Combat, answer: 'correct' | 'incorrect' | 'pass'): Combat {
  if (state.phase !== 'playing' || answer === 'pass') return state
  if (answer === 'incorrect') return damageCombat({ ...state, combo: 0, lastHits: [] }, COMBAT_CONFIG.incorrectDamage)

  const combo = state.combo + 1
  const attack = ATTACK_STAGES.reduce(
    (reached, stage) => combo >= stage.combo || state.attackStage === stage.stage ? stage : reached,
    ATTACK_STAGES[0],
  )
  const targets = selectAttackTargets(state.enemies, attack.targets)
  const lastHits = targets.map((enemy) => ({ enemy, defeated: enemy.hp <= COMBAT_CONFIG.attackDamage }))
  const targetIds = new Set(targets.map(({ id }) => id))
  const enemies = state.enemies
    .map((enemy) => targetIds.has(enemy.id) ? { ...enemy, hp: enemy.hp - COMBAT_CONFIG.attackDamage } : enemy)
    .filter((enemy) => enemy.hp > 0)

  return {
    ...state, combo, attackStage: attack.stage, enemies, lastHits,
    defeated: state.defeated + state.enemies.length - enemies.length,
  }
}

const fastestEnemy = Math.max(...Object.values(ENEMY_TYPES).map(({ speed }) => speed))
const minimumApproachTime = (ENEMY_STAGE.spawnX - ENEMY_STAGE.contactX) / fastestEnemy

export function advanceCombat(state: Combat, seconds: number, level: Level, options?: EnemySpawnOptions): Combat {
  let timeLeft = seconds
  while (state.phase === 'playing') {
    // Enemies cannot pass one another. Split at contact so the next enemy can continue
    // moving in the same tick, including when a background tab resumes.
    const front = state.enemies[0]
    const untilContact = front
      ? (front.x - ENEMY_STAGE.contactX) / ENEMY_TYPES[front.type].speed
      : minimumApproachTime
    const step = Math.min(timeLeft, untilContact)
    if (step > 0) state = { ...state, ...advanceEnemies(state, step, level, state.combo, options) }
    timeLeft -= step
    if (front && step === untilContact) {
      state = damageCombat({ ...state, enemies: state.enemies.slice(1) }, ENEMY_TYPES[front.type].contactDamage)
    }
    if (timeLeft === 0) break
  }
  return state
}

export function finishCombat(state: Combat): Combat {
  return state.phase === 'playing' ? { ...state, phase: state.hp === 0 ? 'defeat' : 'special' } : state
}
