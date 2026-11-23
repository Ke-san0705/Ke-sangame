import { describe, expect, it } from 'vitest'
import { createDuel, judgeDuel, reactionLimits } from './setsuna'

describe('刹那', () => {
  it.each(reactionLimits.map((limit, enemy) => ({ limit, enemy })))(
    'CPU $enemy のしきい値 $limit ms より速い正解だけが勝つ',
    ({ limit, enemy }) => {
      expect(judgeDuel(3, 3, limit - 0.1, enemy)).toBe('win')
      expect(judgeDuel(3, 3, limit, enemy)).toBe('slow')
      expect(judgeDuel(3, 3, limit + 1, enemy)).toBe('slow')
    },
  )

  it('合図前の入力はお手つきになり、2回目で敗北する', () => {
    expect(judgeDuel(3, 3, -1, 0)).toBe('early')
    expect(judgeDuel(9, 3, -1, 0, 1)).toBe('falseStart')
    expect(judgeDuel(3, 3, 0, 0, 1)).toBe('win')
  })

  it('誤答は即敗北になる', () => {
    expect(judgeDuel(9, 3, 1, 0)).toBe('wrong')
  })

  it('待ち時間は1500〜4000msで、演算結果は数字キー1つで入力できる', () => {
    expect(createDuel(() => 0).waitMs).toBe(1500)
    expect(createDuel(() => 0.999999).waitMs).toBe(4000)
    for (let i = 0; i < 1000; i++) {
      const { expression, answer } = createDuel()
      const [left, operation, right] = expression.split(' ')
      expect(left).toMatch(/^\d$/)
      expect(right).toMatch(/^\d$/)
      expect(answer).toBe(operation === '＋' ? Number(left) + Number(right) : Number(left) - Number(right))
      expect(answer).toBeGreaterThanOrEqual(0)
      expect(answer).toBeLessThanOrEqual(9)
    }
  })
})
