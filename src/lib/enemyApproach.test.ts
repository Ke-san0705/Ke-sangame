import { describe, expect, it } from 'vitest'
import { advanceEnemies, createEnemyApproach } from './enemyApproach'
import { COMBO_SPAWN_MULTIPLIERS, ENEMY_DIFFICULTY, ENEMY_STAGE, ENEMY_TYPES } from './enemyApproachConfig'

describe('敵の出現と接近', () => {
  const initial = createEnemyApproach()

  it('ウェーブ休止なしで時間帯ごとの出現数が増える', () => {
    const early = advanceEnemies(initial, 5, 1, 0)
    const later = advanceEnemies(early, 5, 1, 0)
    expect(early.enemies.length).toBeGreaterThan(0)
    expect(later.enemies.length - early.enemies.length).toBeGreaterThan(early.enemies.length)
  })

  it('難易度と現在のコンボで出現率が変わる', () => {
    expect(advanceEnemies(initial, 3, 5, 0).enemies.length)
      .toBeGreaterThan(advanceEnemies(initial, 3, 1, 0).enemies.length)
    for (const { combo, multiplier } of COMBO_SPAWN_MULTIPLIERS) {
      const progress = (count: number) => advanceEnemies(initial, 0.1, 1, count).spawnProgress
      expect(progress(combo)).toBeCloseTo(progress(0) * multiplier)
      if (combo > 0) expect(progress(combo - 1)).toBeLessThan(progress(combo))
    }
  })

  it('高コンボや長時間経過でも難易度ごとの上限で停止する', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      const saturated = advanceEnemies(initial, 60, level, 50)
      expect(saturated.enemies).toHaveLength(ENEMY_DIFFICULTY[level].maxEnemies)
      expect(saturated.spawnProgress).toBe(0)
      expect(advanceEnemies(saturated, 60, level, 50).enemies).toHaveLength(saturated.enemies.length)
    }
  })

  it('右から出現した敵が種別ごとの速度で進み、主人公の手前で止まる', () => {
    const spawned = advanceEnemies(initial, 4, 1, 0)
    const [slime] = spawned.enemies
    expect(slime.type).toBe('slime')
    expect(slime.x).toBeLessThanOrEqual(ENEMY_STAGE.spawnX)
    const moved = advanceEnemies(spawned, 0.1, 1, 0)
    expect(moved.enemies[0].x).toBeCloseTo(slime.x - ENEMY_TYPES.slime.speed * 0.1)

    const settled = advanceEnemies(moved, 90, 1, 0)
    expect(settled.enemies[0].x).toBe(ENEMY_STAGE.contactX)
    expect(new Set(settled.enemies.map(({ type }) => type))).toEqual(new Set(Object.keys(ENEMY_TYPES)))
    for (const [index, enemy] of settled.enemies.entries()) {
      expect(enemy.x).toBeCloseTo(ENEMY_STAGE.contactX + index * ENEMY_STAGE.spacing)
    }
  })
})
