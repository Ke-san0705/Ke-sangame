import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SETSUNA, setsunaFinishMs } from '../lib/setsunaConfig'
import { SetsunaScreen } from './SetsunaScreen'

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  vi.spyOn(performance, 'now').mockReturnValue(1000)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
const input = (key: string) => fireEvent.keyDown(window, { key })
const actions = { onBack: vi.fn(), onReplay: vi.fn() }

it.each([true, false])('音声の有無 (%s) にかかわらず、合図と判定時刻が一致する', (audible) => {
  const play = vi.fn()
  render(<SetsunaScreen {...actions} difficulty="normal" onSound={audible ? play : undefined} />)
  advance(SETSUNA.wait.minMs - 1)
  expect(screen.queryByText('！')).toBeNull()
  advance(1)
  expect(screen.getByText('！')).toBeTruthy()
  vi.mocked(performance.now).mockReturnValue(1123)
  input('0')
  input('Enter')
  expect(screen.getByText('勝利')).toBeTruthy()
  expect(screen.getByText('0.123秒')).toBeTruthy()
  if (audible) expect(play).toHaveBeenCalledWith('duelSignal')
})

it('抜刀の後は静寂を保ち、倒れ込みと納刀に合わせて再開する', () => {
  const play = vi.fn()
  render(<SetsunaScreen {...actions} difficulty="normal" onSound={play} />)
  expect(play.mock.calls.flat()).toEqual(['duelWind', 'heartbeat'])
  advance(SETSUNA.wait.minMs)
  vi.mocked(performance.now).mockReturnValue(1123)
  play.mockClear()
  input('0')
  input('Enter')
  const { stepMs, slashMs, hitStopMs, silenceMs } = SETSUNA.finish
  advance(stepMs)
  expect(play.mock.calls.flat()).toEqual(['silence', 'duelDraw'])
  advance(slashMs + hitStopMs)
  expect(play).toHaveBeenLastCalledWith('silence')
  play.mockClear()
  advance(silenceMs - 1)
  expect(play).not.toHaveBeenCalled()
  advance(1)
  expect(play).toHaveBeenCalledExactlyOnceWith('duelFall')
  advance(setsunaFinishMs - stepMs - slashMs - hitStopMs - silenceMs)
  expect(play).toHaveBeenLastCalledWith('duelSheathe')
})

it('演出をスキップすると、再生中の音と残りの決着音を止める', () => {
  const play = vi.fn()
  render(<SetsunaScreen {...actions} difficulty="normal" onSound={play} />)
  advance(SETSUNA.wait.minMs)
  input('0')
  input('Enter')
  advance(SETSUNA.finish.stepMs)
  play.mockClear()
  fireEvent.click(screen.getByRole('button', { name: '演出をスキップ' }))
  advance(setsunaFinishMs)
  expect(play).toHaveBeenCalledExactlyOnceWith('silence')
})

it('強敵として開始した場合だけ登場音を鳴らす', () => {
  const play = vi.fn()
  render(<SetsunaScreen {...actions} difficulty="normal" rematch onSound={play} />)
  expect(play.mock.calls.flat().filter((cue) => cue === 'duelStrongEnemy')).toHaveLength(1)
})

it.each([true, false])('音声の有無 (%s) にかかわらず、制限時間ちょうどの正答は敗北になる', (audible) => {
  render(<SetsunaScreen {...actions} difficulty="normal" onSound={audible ? vi.fn() : undefined} />)
  advance(SETSUNA.wait.minMs)
  input('0')
  vi.mocked(performance.now).mockReturnValue(1000 + SETSUNA.cpu.initialMs)
  input('Enter')
  expect(screen.getByText('CPUに先を越された')).toBeTruthy()
})

it('10人抜き後に強敵を解放し、開始操作まで合図を出さない', () => {
  localStorage.clear()
  // Zero selects the strong enemy and generates either 0 + 0 or 1 + 9.
  render(<SetsunaScreen {...actions} difficulty="normal" />)
  for (let wins = 0; wins < 10; wins++) {
    advance(SETSUNA.wait.minMs)
    if (wins >= 3) input('1')
    input('0')
    input('Enter')
    advance(setsunaFinishMs)
    advance(SETSUNA.betweenRoundsMs)
    if (wins < 9) expect(screen.queryByRole('button', { name: '強敵戦を開始' })).toBeNull()
  }
  const start = screen.getByRole('button', { name: '強敵戦を開始' })
  advance(SETSUNA.wait.maxMs * 2)
  input('1')
  expect(screen.queryByText('！')).toBeNull()
  fireEvent.click(start)
  advance(SETSUNA.wait.minMs)
  expect(screen.getByText('！')).toBeTruthy()
})
