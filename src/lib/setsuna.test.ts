import { describe, expect, it } from 'vitest'
import { createDuel, judgeDuel, readSetsunaBest, reactionLimit, saveSetsunaBest } from './setsuna'
import { SETSUNA } from './setsunaConfig'

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
    }
  })
})
