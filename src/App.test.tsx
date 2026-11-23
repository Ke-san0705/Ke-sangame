import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { App } from './App'
import { createQuestionGenerator } from './lib/question-generator'

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.25)
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
const enter = (answer: string) => {
  for (const key of answer) fireEvent.keyDown(window, { key })
  fireEvent.keyDown(window, { key: 'Enter' })
}
const first = () => createQuestionGenerator()(1, 'multiplication')

test('結果に正確率・回答時間・スコア・称号を表示し、同じ条件で再戦する', () => {
  render(<App />)
  click('掛け算')
  click('30秒')
  click('START')
  advance(3_000)

  advance(2_000)
  click('pass')
  const generate = createQuestionGenerator()
  generate(1, 'multiplication')
  const second = generate(1, 'multiplication')
  expect(screen.getByRole('status').textContent).toBe('正解：' + first().answer)
  expect(screen.getByText(first().expression + ' =')).toBeTruthy()
  fireEvent.keyDown(window, { key: 'Tab' })
  enter('9')
  expect(screen.getByText('ミス 1')).toBeTruthy()
  advance(999)
  expect(screen.getByRole('status')).toBeTruthy()
  advance(1)
  expect(screen.getByText(second.expression + ' =')).toBeTruthy()
  advance(500)
  enter('0')
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByText(second.expression + ' =')).toBeTruthy()
  advance(1_000)
  enter(second.answer)
  advance(22_501)

  expect(screen.getByRole('heading', { name: 'TIME UP!' })).toBeTruthy()
  expect(screen.getByText('60 pt')).toBeTruthy()
  expect(screen.getByText('電算見習い')).toBeTruthy()
  expect(screen.getByText('1 問')).toBeTruthy()
  expect(screen.getByText('2 回')).toBeTruthy()
  expect(screen.getByText('33.3 %')).toBeTruthy()
  expect(screen.getByText('1.5 秒/問')).toBeTruthy()
  for (const label of ['基本点', '正確率係数', 'コンボ係数']) {
    expect(screen.queryByText(label)).toBeNull()
  }
  expect(screen.getByText('次の称号まであと440点')).toBeTruthy()
  expect(screen.getByText('1 連続')).toBeTruthy()
  const review = within(screen.getByRole('region', { name: '復習リスト' }))
  const [passed, missed, timedOut] = review.getAllByRole('listitem')
  expect(passed.textContent).toContain('パス')
  expect(passed.textContent).toContain(first().expression + ' = ' + first().answer)
  expect(missed.textContent).toContain('ミス')
  expect(missed.textContent).toContain('自分の誤答：0')
  expect(missed.textContent).toContain(second.expression + ' = ' + second.answer)
  expect(timedOut.textContent).toContain('時間切れ')

  click('もう1回')
  expect(screen.getByRole('timer').textContent).toBe('30')
  expect(screen.getByText(first().expression + ' =')).toBeTruthy()
  expect(screen.getByText('正解 0')).toBeTruthy()
  expect(screen.getByText('ミス 0')).toBeTruthy()
  advance(30_001)
  expect(screen.getByText('時間切れ')).toBeTruthy()
})

test('再読み込み後も条件別の自己ベストを保持し、初回と上回ったときだけ通知する', () => {
  const { unmount } = render(<App />)
  click('掛け算')
  click('30秒')
  click('START')
  advance(3_000)
  advance(30_001)
  expect(screen.getByText('NEW RECORD!')).toBeTruthy()
  unmount()

  render(<App />)
  click('掛け算')
  click('30秒')
  click('START')
  advance(3_000)
  advance(30_001)
  expect(screen.queryByText('NEW RECORD!')).toBeNull()
  expect(screen.getByText('自己ベストとタイ記録')).toBeTruthy()

  click('もう1回')
  enter(first().answer)
  advance(30_001)
  expect(screen.getByText('120 pt')).toBeTruthy()
  expect(screen.getByText('NEW RECORD!')).toBeTruthy()

  click('もう1回')
  advance(30_001)
  expect(screen.queryByText('NEW RECORD!')).toBeNull()

  expect(screen.getByText('自己ベストまであと120点')).toBeTruthy()

  click('モード選択に戻る')
  expect(screen.getByRole('button', { name: '掛け算' }).getAttribute('aria-pressed')).toBe('true')
  click('60秒')
  click('START')
  advance(3_000)
  advance(60_001)
  expect(screen.getByText('NEW RECORD!')).toBeTruthy()
})

function stubAudio() {
  const createOscillator = vi.fn(() => ({
    frequency: { value: 0 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }))
  vi.stubGlobal('AudioContext', class {
    state = 'running'
    currentTime = 0
    destination = {}
    close = vi.fn().mockResolvedValue(undefined)
    createOscillator = createOscillator
    createGain() {
      return {
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      }
    }
  })
  return createOscillator
}

test('正解・不正解・残り5秒からのカウントダウン・時間切れで効果音を鳴らす', () => {
  const play = stubAudio()
  render(<App />)
  click('掛け算')
  click('30秒')
  click('START')
  advance(3_000)

  enter('0')
  expect(play).toHaveBeenCalledTimes(1)
  enter(first().answer)
  expect(play).toHaveBeenCalledTimes(3)

  advance(24_999)
  expect(play).toHaveBeenCalledTimes(3)
  for (const expected of [4, 5, 6, 7, 8]) {
    advance(expected === 4 ? 1 : 1_000)
    expect(play).toHaveBeenCalledTimes(expected)
  }
  advance(1_001)
  expect(screen.getByRole('heading', { name: 'TIME UP!' })).toBeTruthy()
  expect(play).toHaveBeenCalledTimes(11)
})

test('連続正解で正解音が高くなり、誤答とパスで元の音階に戻る', () => {
  localStorage.setItem('ke-sangame:personal-best:multiply:1:30', JSON.stringify({
    score: 0, curve: Array(31).fill(0),
  }))
  const play = stubAudio()
  const frequencies = () => play.mock.results.map(({ value }) => value.frequency.value)
  const generate = createQuestionGenerator()
  const nextAnswer = () => generate(1, 'multiplication').answer
  render(<App />)
  click('掛け算')
  click('30秒')
  click('START')
  advance(3_000)

  for (let i = 0; i < 11; i++) enter(nextAnswer())
  expect(screen.getByText('ベスト比 +11問')).toBeTruthy()
  const pitches = frequencies()
  expect(pitches.slice(0, 2)).toEqual([660, 880])
  expect(pitches[2]).toBeGreaterThan(pitches[0])
  expect(pitches[8]).toBeGreaterThan(pitches[2])
  expect(pitches[18]).toBeGreaterThan(pitches[8])
  expect(pitches.slice(20, 22)).toEqual(pitches.slice(18, 20))

  enter('0')
  expect(frequencies().at(-1)).toBeLessThan(pitches[0])
  expect(screen.getByText('ベスト比 +11問')).toBeTruthy()
  expect(screen.getByText('ミス 1').classList.contains('game-feedback-pop')).toBe(true)
  enter(nextAnswer())
  expect(frequencies().slice(-2)).toEqual([660, 880])

  enter(nextAnswer())
  click('pass')
  expect(frequencies().slice(-2)).toEqual(pitches.slice(2, 4))
  nextAnswer()
  advance(1_000)
  enter(nextAnswer())
  expect(frequencies().slice(-2)).toEqual([660, 880])
})

test('ミュートを再戦と再読み込み後も保持し、解除できる', () => {
  const play = stubAudio()
  const { unmount } = render(<App />)
  expect(screen.getByRole('button', { name: 'ミュート', pressed: false }).textContent).toBe('ミュート OFF')
  click('ミュート')
  expect(screen.getByRole('button', { name: 'ミュート', pressed: true }).textContent).toBe('ミュート ON')
  click('30秒')
  click('START')
  advance(3_000)
  enter('0')
  expect(screen.getByText('ミス 1').classList.contains('game-feedback-pop')).toBe(true)
  advance(30_001)
  click('もう1回')
  expect(screen.getByText('ベスト比 0問')).toBeTruthy()
  advance(30_001)
  expect(play).not.toHaveBeenCalled()

  unmount()
  render(<App />)
  expect(screen.getByRole('button', { name: 'ミュート', pressed: true }).textContent).toBe('ミュート ON')
  click('ミュート')
  expect(screen.getByRole('button', { name: 'ミュート', pressed: false }).textContent).toBe('ミュート OFF')
  click('START')
  advance(3_000)
  enter('0')
  expect(play).toHaveBeenCalledTimes(1)
})

test('締切と同時に正解して復習リストが空の場合は案内を表示する', () => {
  render(<App />)
  click('掛け算')
  click('30秒')
  click('START')
  advance(3_000)
  for (const key of first().answer) fireEvent.keyDown(window, { key })
  window.setTimeout(() => fireEvent.keyDown(window, { key: 'Enter' }), 30_000)
  advance(30_001)

  const review = within(screen.getByRole('region', { name: '復習リスト' }))
  expect(review.getByText('復習する問題はありません。')).toBeTruthy()
  expect(review.queryByRole('list')).toBeNull()
})

test('同じ条件で自己ベストの経過秒ごとの正解数と比較し、更新したカーブを再読み込み後も使う', () => {
  const generate = createQuestionGenerator()
  const firstAnswer = generate(1, 'multiplication').answer
  const secondAnswer = generate(1, 'multiplication').answer
  const { unmount } = render(<App />)
  click('掛け算')
  click('30秒')
  click('START')
  advance(3_000)
  expect(screen.queryByText(/ベスト比/)).toBeNull()
  advance(2_000)
  enter(firstAnswer)
  advance(28_001)

  click('もう1回')
  expect(screen.getByText('ベスト比 0問')).toBeTruthy()
  advance(1_000)
  enter(firstAnswer)
  expect(screen.getByText('ベスト比 +1問')).toBeTruthy()
  advance(1_000)
  expect(screen.getByText('ベスト比 0問')).toBeTruthy()
  enter(secondAnswer)
  advance(28_001)
  expect(screen.getByText('NEW RECORD!')).toBeTruthy()
  unmount()

  render(<App />)
  click('掛け算')
  click('30秒')
  click('START')
  advance(3_000)
  advance(1_000)
  expect(screen.getByText('ベスト比 −1問')).toBeTruthy()
  advance(1_000)
  expect(screen.getByText('ベスト比 −2問')).toBeTruthy()
  advance(28_001)

  click('もう1回')
  advance(2_000)
  expect(screen.getByText('ベスト比 −2問')).toBeTruthy()
  advance(28_001)
  click('モード選択に戻る')
  click('60秒')
  click('START')
  advance(5_000)
  expect(screen.queryByText(/ベスト比/)).toBeNull()
})

test('スコアだけの自己ベストは維持し、タイ記録でカーブを補完する', () => {
  localStorage.setItem('ke-sangame:personal-best:multiply:1:30', '120')
  render(<App />)
  click('掛け算')
  click('30秒')
  click('START')
  advance(3_000)
  expect(screen.queryByText(/ベスト比/)).toBeNull()
  advance(30_001)
  expect(screen.getByText('自己ベストまであと120点')).toBeTruthy()

  click('もう1回')
  advance(1_000)
  enter(first().answer)
  advance(29_001)
  expect(screen.getByText('自己ベストとタイ記録')).toBeTruthy()
  click('もう1回')
  advance(1_000)
  expect(screen.getByText('ベスト比 −1問')).toBeTruthy()
})
