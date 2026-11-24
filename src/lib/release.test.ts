import { expect, test } from 'vitest'
import { breaksPlanet, planRelease } from './release'
import type { Enemy } from './enemyApproach'

const remaining: Enemy[] = [{ id: 7, type: 'golem', x: 0.5, hp: 3 }]

test.each([
  [0, 0, 1],
  [23, 2645, 1],
  [199, 198005, 1],
  [200, 200000, 2],
  [399, 796005, 2],
  [400, 800000, 3],
  [599, 1794005, 3],
  [600, 1800000, 4],
] as const)('チャージ %i から規模と既存の飛距離・地球爆破を判定する', (power, distanceKm, tier) => {
  const { result } = planRelease(power, { enemies: remaining, nextEnemyId: 8, defeated: 4 })
  expect(result).toMatchObject({ distanceKm, tier })
  expect(breaksPlanet(result)).toBe(power >= 400)
})

test('撃破済み・残存・増援を重複なく数え、段階が上がると群れと連撃が増える', () => {
  const weak = planRelease(0, { enemies: remaining, nextEnemyId: 8, defeated: 4 })
  const strong = planRelease(600, { enemies: remaining, nextEnemyId: 8, defeated: 4 })
  for (const plan of [weak, strong]) {
    const targets = plan.waves.flatMap(({ targets }) => targets)
    expect(targets.filter(({ reinforcement }) => !reinforcement).map(({ enemy }) => enemy)).toEqual(remaining)
    expect(new Set(targets.map(({ enemy }) => enemy.id)).size).toBe(targets.length)
    expect(plan.waves.at(-1)?.koCount).toBe(plan.result.koCount)
    expect(plan.result.koCount).toBe(4 + targets.length)
    expect(plan.waves.every(({ targets }) => targets.length > 0)).toBe(true)
  }
  expect(strong.result.koCount).toBeGreaterThan(weak.result.koCount)
  expect(strong.waves.length).toBeGreaterThan(weak.waves.length)
})
