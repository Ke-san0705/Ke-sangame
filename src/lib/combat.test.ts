import { describe, expect, it } from 'vitest'
import { advanceCombat, applyCombatAnswer, createCombat, damageCombat, finishCombat } from './combat'
import { COMBAT_CONFIG, ENEMY_STAGE, ENEMY_TYPES } from './enemyApproachConfig'

describe('討伐のダメージと勝敗', () => {
  it('最も近い敵に毎回攻撃し、耐久がなくなった敵を討伐する', () => {
    const state = { ...createCombat(), enemies: [
      { id: 0, type: 'slime' as const, x: 0.8, hp: 1 },
      { id: 1, type: 'goblin' as const, x: 0.4, hp: 2 },
    ] }
    const first = applyCombatAnswer(state, 'correct')
    expect(first.enemies.map(({ hp }) => hp)).toEqual([1, 1])
    const second = applyCombatAnswer(first, 'correct')
    expect(second.enemies.map(({ id }) => id)).toEqual([0])
    expect(second).toMatchObject({ combo: 2, defeated: 1 })
  })

  it('パスでコンボを維持し、誤答でHPとコンボを減らして攻撃段階を維持する', () => {
    const state = { ...createCombat(), combo: 3, attackStage: 2 }
    expect(applyCombatAnswer(state, 'pass')).toBe(state)
    expect(applyCombatAnswer(state, 'incorrect')).toMatchObject({
      hp: COMBAT_CONFIG.maxHp - COMBAT_CONFIG.incorrectDamage, combo: 0, attackStage: 2,
    })
    expect(damageCombat(state, -1).hp).toBe(COMBAT_CONFIG.maxHp)
  })

  it('接触で敵種別のダメージを一度だけ受け、消滅後も新しいIDを使う', () => {
    const state = { ...createCombat(), nextEnemyId: 1, enemies: [
      { id: 0, type: 'slime' as const, x: ENEMY_STAGE.contactX, hp: 1 },
    ] }
    const contact = advanceCombat(state, 0, 1)
    expect(contact).toMatchObject({ hp: COMBAT_CONFIG.maxHp - ENEMY_TYPES.slime.contactDamage, enemies: [], defeated: 0 })
    const later = advanceCombat(contact, 4, 1)
    expect(later.hp).toBe(contact.hp)
    expect(later.enemies[0].id).toBe(1)
  })

  it('制限時間ちょうどの接触でHPゼロなら敗北し、生存時は超必殺技へ進む', () => {
    const state = { ...createCombat(), hp: 1, nextEnemyId: 1, enemies: [
      { id: 0, type: 'slime' as const, x: ENEMY_STAGE.contactX, hp: 1 },
    ] }
    const defeated = advanceCombat(state, 0, 1)
    expect(finishCombat(defeated)).toMatchObject({ hp: 0, phase: 'defeat' })
    expect(damageCombat(state, 1000)).toMatchObject({ hp: 0, phase: 'defeat' })
    expect(finishCombat(createCombat()).phase).toBe('special')
  })
})
