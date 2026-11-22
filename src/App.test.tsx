import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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

  advance(2_000)
  click('pass')
  const generate = createQuestionGenerator()
  generate(1, 'multiplication')
  const second = generate(1, 'multiplication')
  advance(500)
  enter('0')
  advance(1_000)
  enter(second.answer)
  advance(23_500)

  expect(screen.getByRole('heading', { name: 'TIME UP!' })).toBeTruthy()
  expect(screen.getByText('60 pt')).toBeTruthy()
  expect(screen.getByText('電算見習い')).toBeTruthy()
  expect(screen.getByText('1 問')).toBeTruthy()
  expect(screen.getByText('2 回')).toBeTruthy()
  expect(screen.getByText('33.3 %')).toBeTruthy()
  expect(screen.getByText('1.5 秒/問')).toBeTruthy()

  click('もう一度遊ぶ')
  expect(screen.getByRole('timer').textContent).toBe('30')
  expect(screen.getByText(first().expression + ' =')).toBeTruthy()
  expect(screen.getByText('正解 0')).toBeTruthy()
  expect(screen.getByText('ミス 0')).toBeTruthy()
})

test('再読み込み後も条件別の自己ベストを保持し、初回と上回ったときだけ通知する', () => {
  const { unmount } = render(<App />)
  click('掛け算')
  click('30秒')
  click('START')
  advance(30_000)
  expect(screen.getByText('NEW RECORD!')).toBeTruthy()
  unmount()

  render(<App />)
  click('掛け算')
  click('30秒')
  click('START')
  advance(30_000)
  expect(screen.queryByText('NEW RECORD!')).toBeNull()

  click('もう一度遊ぶ')
  enter(first().answer)
  advance(30_000)
  expect(screen.getByText('120 pt')).toBeTruthy()
  expect(screen.getByText('NEW RECORD!')).toBeTruthy()

  click('もう一度遊ぶ')
  advance(30_000)
  expect(screen.queryByText('NEW RECORD!')).toBeNull()

  click('モード選択に戻る')
  expect(screen.getByRole('button', { name: '掛け算' }).getAttribute('aria-pressed')).toBe('true')
  click('60秒')
  click('START')
  advance(60_000)
  expect(screen.getByText('NEW RECORD!')).toBeTruthy()
})
