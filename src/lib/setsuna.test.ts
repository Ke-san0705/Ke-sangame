import { describe, expect, it, vi } from 'vitest'
import { createDuel, judgeDuel, readSetsunaBest, reactionLimit, saveSetsunaBest } from './setsuna'
import { SETSUNA } from './setsunaConfig'
import { rollsStrongEnemy, setsunaRank } from './setsunaProgress'

describe('刹那', () => {
  it('合図とCPUの締切の境界を判定する', () => {
    const limit = reactionLimit(0)
    expect(judgeDuel(3, 3, -1, limit)).toBe('early')
    expect(judgeDuel(9, 3, -1, limit, 1)).toBe('falseStart')
    expect(judgeDuel(3, 3, 0, limit, 1)).toBe('win')
    expect(judgeDuel(3, 3, limit - 0.1, limit)).toBe('win')
    expect(judgeDuel(9, 3, 1, limit)).toBe('wrong')
    expect(judgeDuel(3, 3, limit, limit)).toBe('slow')
    expect(judgeDuel(9, 3, limit, limit)).toBe('slow')
    expect(judgeDuel(null, 3, limit + 1, limit)).toBe('slow')
  })

  it('CPUは勝ち抜くほど速くなるが下限を下回らない', () => {
    expect(reactionLimit(0)).toBe(SETSUNA.cpu.initialMs)
    expect(reactionLimit(1)).toBeLessThan(reactionLimit(0))
    expect(reactionLimit(100_000)).toBe(SETSUNA.cpu.minMs)
  })

  it('初戦は1桁で、同じ戦数でも設定の難易度で2桁問題の出現が変わる', () => {
    expect(createDuel('easy', 0, () => 0).waitMs).toBe(SETSUNA.wait.minMs)
    expect(createDuel('easy', 0, () => 0.999999).waitMs).toBe(SETSUNA.wait.maxMs)
    expect(createDuel('hard', 0, () => 0.25).answer).toBeLessThan(10)
    expect(createDuel('easy', 2, () => 0.25).answer).toBeLessThan(10)
    const duel = createDuel('hard', 2, () => 0.25)
    expect(duel.answer).toBeGreaterThanOrEqual(10)
    const [left, , right] = duel.expression.split(' ')
    expect(duel.answer).toBe(Number(left) + Number(right))
    expect(createDuel('hard', 100, () => 0.999999).answer).toBeLessThan(10)
  })

  it('従来の記録を読み、6人以上の記録を保存して再読込できる', () => {
    const key = 'ke-sangame:setsuna-best'
    localStorage.setItem(key, JSON.stringify({ fastestMs: 205, defeated: 5 }))
    try {
      expect(readSetsunaBest()).toEqual({ fastestMs: 205, defeated: 5 })
      saveSetsunaBest(310, 123)
      saveSetsunaBest(null, 1)
      expect(readSetsunaBest()).toEqual({ fastestMs: 205, defeated: 123 })
    } finally {
      localStorage.removeItem(key)
    localStorage.removeItem(`${key}:normal`)
    }
  })
})

it('強敵は10勝以降だけ抽選し、15%から不遇ごとに10ポイント増えて50%で止まる', () => {
  const random = vi.fn(() => 0)
  expect(rollsStrongEnemy(9, 0, random)).toBe(false)
  expect(random).not.toHaveBeenCalled()
  for (const [misses, probability] of [0.15, 0.25, 0.35, 0.45, 0.5, 0.5].entries()) {
    expect(rollsStrongEnemy(10 + misses, misses, () => probability - 0.001)).toBe(true)
    expect(rollsStrongEnemy(10 + misses, misses, () => probability)).toBe(false)
  }
})

it.each([
  [2, '無段'], [3, '初段'], [5, '二段'], [10, '三段'], [15, '四段'],
  [20, '五段'], [30, '免許皆伝'], [50, '剣聖'],
])('%i人抜きで%sになる', (defeated, rank) => {
  expect(setsunaRank('normal', { defeated, fastestMs: null })).toBe(rank)
})
