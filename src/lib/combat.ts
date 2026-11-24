import { advanceEnemies, createEnemyApproach, type EnemyApproach } from './enemyApproach'
import { COMBAT_CONFIG, ENEMY_STAGE, ENEMY_TYPES } from './enemyApproachConfig'
import type { Level } from './question-generator'

type Combat = EnemyApproach & {
  hp: number
  combo: number
  attackStage: number
  defeated: number
  phase: 'playing' | 'defeat' | 'special'
}

export function createCombat(): Combat {
  return {
    ...createEnemyApproach(),
    hp: COMBAT_CONFIG.maxHp,
    combo: 0,
    attackStage: COMBAT_CONFIG.initialAttackStage,
    defeated: 0,
    phase: 'playing',
  }
}

export function damageCombat(state: Combat, damage: number): Combat {
  if (state.phase !== 'playing') return state
  const hp = Math.max(0, Math.min(COMBAT_CONFIG.maxHp, state.hp - damage))
  return { ...state, hp, phase: hp === 0 ? 'defeat' : 'playing' }
}

export function applyCombatAnswer(state: Combat, answer: 'correct' | 'incorrect' | 'pass'): Combat {
  if (state.phase !== 'playing' || answer === 'pass') return state
  if (answer === 'incorrect') return damageCombat({ ...state, combo: 0 }, COMBAT_CONFIG.incorrectDamage)

  const next = { ...state, combo: state.combo + 1 }
  const target = state.enemies.reduce<(typeof state.enemies)[number] | undefined>(
    (closest, enemy) => !closest || enemy.x < closest.x ? enemy : closest, undefined,
  )
  if (!target) return next

  const hp = target.hp - COMBAT_CONFIG.attackDamage
  return hp <= 0
    ? { ...next, defeated: next.defeated + 1, enemies: state.enemies.filter((enemy) => enemy.id !== target.id) }
    : { ...next, enemies: state.enemies.map((enemy) => enemy.id === target.id ? { ...enemy, hp } : enemy) }
}

const fastestEnemy = Math.max(...Object.values(ENEMY_TYPES).map(({ speed }) => speed))
const minimumApproachTime = (ENEMY_STAGE.spawnX - ENEMY_STAGE.contactX) / fastestEnemy

export function advanceCombat(state: Combat, seconds: number, level: Level): Combat {
  let timeLeft = seconds
  while (state.phase === 'playing') {
    // Enemies cannot pass one another. Split at contact so the next enemy can continue
    // moving in the same tick, including when a background tab resumes.
    const front = state.enemies[0]
    const untilContact = front
      ? (front.x - ENEMY_STAGE.contactX) / ENEMY_TYPES[front.type].speed
      : minimumApproachTime
    const step = Math.min(timeLeft, untilContact)
    if (step > 0) state = { ...state, ...advanceEnemies(state, step, level, state.combo) }
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
