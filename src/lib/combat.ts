import { advanceEnemies, createEnemyApproach, type Enemy, type EnemyApproach } from './enemyApproach'
import { ATTACK_STAGES, COMBAT_CONFIG, COMBO_SPECIAL, ENEMY_STAGE, ENEMY_TYPES } from './enemyApproachConfig'
import type { Level } from './question-generator'

type Combat = EnemyApproach & {
  hp: number
  combo: number
  attackStage: number
  defeated: number
  comboSpecial?: { targets: readonly Enemy[]; healed: number }
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

export function selectAttackTargets(enemies: Combat['enemies'], limit: number) {
  return [...enemies].sort((a, b) => a.x - b.x).slice(0, limit)
}

export function applyCombatAnswer(state: Combat, answer: 'correct' | 'incorrect' | 'pass'): Combat {
  if (state.phase !== 'playing' || answer === 'pass') return state
  if (answer === 'incorrect') return damageCombat({ ...state, combo: 0, comboSpecial: undefined }, COMBAT_CONFIG.incorrectDamage)

  const combo = state.combo + 1
  const attack = ATTACK_STAGES.reduce(
    (reached, stage) => combo >= stage.combo || state.attackStage === stage.stage ? stage : reached,
    ATTACK_STAGES[0],
  )
  const targetIds = new Set(
    selectAttackTargets(state.enemies, attack.targets).map(({ id }) => id),
  )
  const specialTargets = combo % COMBO_SPECIAL.interval === 0
    ? selectAttackTargets(state.enemies.filter(({ x }) =>
      x >= ENEMY_STAGE.heroX && x <= ENEMY_STAGE.heroX + COMBO_SPECIAL.range,
    ), COMBO_SPECIAL.maxTargets)
    : undefined
  const specialIds = specialTargets && new Set(specialTargets.map(({ id }) => id))
  const enemies = state.enemies
    .map((enemy) => {
      const damage = (targetIds.has(enemy.id) ? COMBAT_CONFIG.attackDamage : 0)
        + (specialIds?.has(enemy.id) ? COMBO_SPECIAL.damage : 0)
      return damage ? { ...enemy, hp: enemy.hp - damage } : enemy
    })
    .filter((enemy) => enemy.hp > 0)
  const hp = specialTargets ? Math.min(COMBAT_CONFIG.maxHp, state.hp + COMBO_SPECIAL.heal) : state.hp

  return {
    ...state, hp, combo, attackStage: attack.stage, enemies,
    defeated: state.defeated + state.enemies.length - enemies.length,
    comboSpecial: specialTargets && { targets: specialTargets, healed: hp - state.hp },
  }
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
