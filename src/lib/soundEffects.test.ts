import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSoundEffects, readVolume, saveVolume } from './soundEffects'

function oscillator() {
  return {
    frequency: { value: 0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: undefined as (() => void) | undefined,
  }
}

function gain() {
  return {
    gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

const createOscillator = vi.fn(oscillator)
const createGain = vi.fn(gain)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.stubGlobal('AudioContext', class {
    state = 'running'
    currentTime = 0
    destination = {}
    createOscillator = createOscillator
    createGain = createGain
  })
})

afterEach(() => vi.unstubAllGlobals())

describe('討伐モードの効果音', () => {
  it('コンボが増えると同じ斬撃の音程が上がる', () => {
    const sound = createSoundEffects()
    sound.unlock()
    sound.play('slash', 1)
    sound.play('slash', 10)
    expect(createOscillator.mock.results[2].value.frequency.value)
      .toBeGreaterThan(createOscillator.mock.results[0].value.frequency.value)
  })

  it('全効果音に同時発音の上限を適用し、終了した音の枠を再利用する', () => {
    const sound = createSoundEffects()
    sound.unlock()
    for (let i = 0; i < 30; i += 1) sound.play('heartbeat')
    expect(createOscillator).toHaveBeenCalledTimes(10)
    for (const { value } of createOscillator.mock.results) value.onended?.()
    sound.play('heartbeat')
    expect(createOscillator).toHaveBeenCalledTimes(12)
  })

  it('静寂で予約済みの音も切り、続く超必殺技の爆発を再生する', () => {
    const sound = createSoundEffects()
    sound.unlock()
    for (let i = 0; i < 5; i += 1) sound.play('slash')
    const scheduled = createOscillator.mock.results.map(({ value }) => value)
    sound.play('silence')
    expect(scheduled).toHaveLength(10)
    for (const voice of scheduled) {
      expect(voice.stop).toHaveBeenLastCalledWith()
      expect(voice.disconnect).toHaveBeenCalledOnce()
    }
    sound.play('ultimateBlast', 0.9)
    expect(createOscillator).toHaveBeenCalledTimes(13)
  })

  it('音量を保存し、出力全体に適用する。ゼロの間は発音を予約しない', () => {
    expect(readVolume()).toBe(1)
    saveVolume(0.4)
    expect(readVolume()).toBe(0.4)
    const sound = createSoundEffects(readVolume())
    sound.unlock()
    const output = createGain.mock.results[0].value
    expect(output.gain.value).toBe(0.4)
    sound.setVolume(0)
    expect(output.gain.value).toBe(0)
    sound.play('slash')
    expect(createOscillator).not.toHaveBeenCalled()
  })
})
