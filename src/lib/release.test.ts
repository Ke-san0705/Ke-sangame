import { expect, test } from 'vitest'
import { calculateRelease } from './release'

test.each([
  [0, 0, 0, 1],
  [23, 230, 2645, 1],
  [199, 1990, 198005, 1],
  [200, 2000, 200000, 2],
  [399, 3990, 796005, 2],
  [400, 4000, 800000, 3],
  [599, 5990, 1794005, 3],
  [600, 6000, 1800000, 4],
] as const)('チャージ %i から KO、飛距離、規模を換算する', (power, koCount, distanceKm, tier) => {
  expect(calculateRelease(power)).toEqual({ koCount, distanceKm, tier })
})
