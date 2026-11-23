import { expect, test } from 'vitest'
import { calculateRelease, isCriticalRelease } from './release'

test.each([
  [0, 0, 0, 1],
  [23, 230, 2645, 1],
  [199, 1990, 198005, 1],
  [200, 2000, 200000, 2],
  [399, 3990, 796005, 2],
  [400, 4000, 800000, 3],
] as const)('チャージ %i から KO、飛距離、規模を換算する', (power, koCount, distanceKm, tier) => {
  expect(calculateRelease(power)).toEqual({ koCount, distanceKm, tier })
})

test.each([[23, 2], [200, 3], [400, 3]] as const)('会心で規模だけを1段階上げる（チャージ %i）', (power, tier) => {
  expect(calculateRelease(power, true)).toEqual({ ...calculateRelease(power), tier })
})

test.each([
  [-1, false], [0, false], [209, false], [210, true], [250, true],
  [290, true], [291, false], [500, false], [750, true], [1000, false],
] as const)('経過 %i ms のメーター判定', (elapsed, critical) => {
  expect(isCriticalRelease(elapsed)).toBe(critical)
})
