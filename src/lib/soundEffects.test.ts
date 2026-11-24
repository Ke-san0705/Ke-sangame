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
    gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
}

const createOscillator = vi.fn(oscillator)
const createGain = vi.fn(gain)
const createBufferSource = vi.fn(oscillator)
const createBuffer = vi.fn((_channels: number, length: number) => ({
  getChannelData: () => new Float32Array(length),
}))
const createBiquadFilter = vi.fn(() => ({ frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  vi.stubGlobal('AudioContext', class {
    state = 'running'
    currentTime = 0
    destination = {}
    createOscillator = createOscillator
    createGain = createGain
    createBuffer = createBuffer
    createBufferSource = createBufferSource
    createBiquadFilter = createBiquadFilter
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

it('刹那の風も共通の音量、発音上限、静寂に従う', () => {
  const sound = createSoundEffects()
  sound.unlock()
  sound.setVolume(0)
  sound.play('duelWind')
  expect(createBufferSource).not.toHaveBeenCalled()
  sound.setVolume(0.5)
  sound.play('duelWind')
  for (let i = 0; i < 5; i += 1) sound.play('heartbeat')
  sound.play('duelWind')
  sound.play('duelSignal')
  sound.play('duelWind')
  expect(createBufferSource).toHaveBeenCalledTimes(2)
  expect(createOscillator).toHaveBeenCalledTimes(8)
  expect(createBuffer).toHaveBeenCalledOnce()
  sound.play('silence')
  for (const { value } of createBufferSource.mock.results) {
    expect(value.stop).toHaveBeenLastCalledWith()
    expect(value.disconnect).toHaveBeenCalledOnce()
  }
  for (const { value } of createBiquadFilter.mock.results) expect(value.disconnect).toHaveBeenCalledOnce()
  sound.play('duelFall')
  expect(createOscillator).toHaveBeenCalledTimes(10)
})

it('音声再開待ちに強敵が登場しても、再生を予約して静寂でキャンセルできる', () => {
  vi.stubGlobal('AudioContext', class extends AudioContext {
    state = 'suspended' as const
    resume = vi.fn().mockResolvedValue(undefined)
  })
  const sound = createSoundEffects()
  sound.unlock()
  sound.play('duelStrongEnemy')
  expect(createOscillator).toHaveBeenCalledTimes(3)
  sound.play('silence')
  for (const { value } of createOscillator.mock.results) expect(value.stop).toHaveBeenLastCalledWith()
})
