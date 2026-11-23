import { expect, test } from 'vitest'
import { calculateCharge } from './charge'

test.each([
  [{ correctCount: 0, maxCombo: 0, criticalCount: 0 }, 0],
  [{ correctCount: 1, maxCombo: 1, criticalCount: 0 }, 15],
  [{ correctCount: 4, maxCombo: 2, criticalCount: 1 }, 58],
  [{ correctCount: 5, maxCombo: 2, criticalCount: 1 }, 68],
  [{ correctCount: 4, maxCombo: 3, criticalCount: 1 }, 63],
  [{ correctCount: 4, maxCombo: 2, criticalCount: 2 }, 66],
])('チャージ量を正解数・最大コンボ・会心回数から計算する（%o）', (counts, charge) => {
  expect(calculateCharge(counts)).toBe(charge)
})
