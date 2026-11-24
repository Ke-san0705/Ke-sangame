import { describe, expect, it } from 'vitest'
import { advanceCombat, applyCombatAnswer, createCombat, damageCombat, finishCombat } from './combat'
import { COMBAT_CONFIG, ENEMY_STAGE, ENEMY_TYPES } from './enemyApproachConfig'

describe('討伐のダメージと勝敗', () => {
  it('最も近い敵に毎回攻撃し、耐久がなくなった敵を討伐する', () => {
    const state = { ...createCombat(), enemies: [
      { id: 0, type: 'slime' as const, x: 0.8, hp: 1 },
      { id: 1, type: 'golem' as const, x: 0.4, hp: 2 },
    ] }
    const first = applyCombatAnswer(state, 'correct')
    expect(first.enemies.map(({ hp }) => hp)).toEqual([1, 1])
    const second = applyCombatAnswer(first, 'correct')
    expect(second.enemies.map(({ id }) => id)).toEqual([0])
    expect(second).toMatchObject({ combo: 2, defeated: 1 })
  })

  it.each(['slime', 'goblin', 'wolf'] as const)('%s は実際の出現時の耐久から1ヒットで倒れる', (type) => {
    const enemy = { id: 0, type, x: 0.4, hp: ENEMY_TYPES[type].durability }
    expect(applyCombatAnswer({ ...createCombat(), enemies: [enemy] }, 'correct'))
      .toMatchObject({ enemies: [], defeated: 1, lastHits: [{ enemy, defeated: true }] })
  })

  it('ゴーレムのひるみと最後の一撃を区別する', () => {
    const enemy = { id: 0, type: 'golem' as const, x: 0.4, hp: ENEMY_TYPES.golem.durability }
    let state = { ...createCombat(), enemies: [enemy] } as ReturnType<typeof createCombat>
    for (let hp = enemy.hp - 1; hp > 0; hp--) {
      state = applyCombatAnswer(state, 'correct')
      expect(state).toMatchObject({ enemies: [{ hp }], lastHits: [{ enemy: { id: 0 }, defeated: false }] })
    }
    expect(applyCombatAnswer(state, 'correct'))
      .toMatchObject({ enemies: [], defeated: 1, lastHits: [{ enemy: { id: 0 }, defeated: true }] })
  })

  it('パスでコンボを維持し、誤答でHPとコンボを減らして攻撃段階を維持する', () => {
    const state = { ...createCombat(), combo: 3, attackStage: 2 }
    expect(applyCombatAnswer(state, 'pass')).toBe(state)
    expect(applyCombatAnswer(state, 'incorrect')).toMatchObject({
      hp: COMBAT_CONFIG.maxHp - COMBAT_CONFIG.incorrectDamage, combo: 0, attackStage: 2,
    })
    expect(damageCombat(state, -1).hp).toBe(COMBAT_CONFIG.maxHp)
  })

  it.each([
    [0, 1, 1], [3, 1, 1], [4, 2, 2], [8, 2, 2], [9, 3, 4], [18, 3, 4],
    [19, 4, 8], [28, 4, 8], [29, 4, 8], [48, 4, 8], [49, 4, 8], [50, 4, 8], [99, 4, 8],
  ])('コンボ %i からの正解で段階 %i、対象数 %i になる', (combo, attackStage, targetCount) => {
    const enemies = Array.from({ length: 10 }, (_, id) => ({
      id, type: 'slime' as const, x: 1 - id / 1000, hp: 1,
    }))
    const next = applyCombatAnswer({ ...createCombat(), combo, enemies }, 'correct')
    expect(next).toMatchObject({ combo: combo + 1, attackStage, defeated: targetCount })
    expect(next.enemies.map(({ id }) => id)).toEqual(enemies.slice(0, -targetCount).map(({ id }) => id))
  })

  it('誤答後も複数対象へ攻撃し、出現率は現在コンボに従う', () => {
    const beforeEvolution = { ...createCombat(), combo: 19 }
    const evolved = applyCombatAnswer(beforeEvolution, 'correct')
    const missed = applyCombatAnswer(evolved, 'incorrect')
    const baseSpawn = advanceCombat(createCombat(), 1, 1)
    expect(advanceCombat(evolved, 1, 1).nextEnemyId).toBeGreaterThan(baseSpawn.nextEnemyId)
    expect(advanceCombat(missed, 1, 1)).toMatchObject({
      combo: 0, attackStage: 4, nextEnemyId: baseSpawn.nextEnemyId, spawnProgress: baseSpawn.spawnProgress,
    })

    const next = applyCombatAnswer({ ...missed, enemies: [
      { id: 0, type: 'slime', x: 0.4, hp: 1 },
      { id: 1, type: 'golem', x: 0.5, hp: 2 },
    ] }, 'correct')
    expect(next).toMatchObject({ combo: 1, attackStage: 4, defeated: 1, enemies: [{ id: 1, hp: 1 }] })
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

describe('コンボ到達時の通常攻撃', () => {
  it.each([[10, 4], [20, 8]])('%i コンボでHPを維持し、最も近い %i 体だけに通常ダメージを与える', (combo, targetCount) => {
    const hp = COMBAT_CONFIG.maxHp - COMBAT_CONFIG.incorrectDamage
    const enemies = Array.from({ length: 10 }, (_, id) => ({
      id, type: 'golem' as const, x: 0.4 + id * 0.05, hp: 5,
    }))
    const next = applyCombatAnswer({ ...createCombat(), hp, combo: combo - 1, enemies }, 'correct')

    expect(next).toMatchObject({ combo, hp })
    expect(next.enemies.map((enemy) => enemy.hp)).toEqual(
      enemies.map((enemy, index) => index < targetCount ? enemy.hp - COMBAT_CONFIG.attackDamage : enemy.hp),
    )
  })
})
