import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { App } from '../App'
import { createQuestionGenerator } from '../lib/question-generator'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('既定の足し算・初級・60秒で1タップで開始できる', () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  render(<App />)

  expect(screen.getByRole('heading', { level: 1, name: '計算無双' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'START' }))
  act(() => vi.advanceTimersByTime(3_000))

  const { expression } = createQuestionGenerator(() => 0.5)(1, 'addition')
  expect(screen.getByText(expression + ' =')).toBeTruthy()
  expect(screen.getByLabelText('残り時間').textContent).toBe('60')
})

test('選んだ演算・レベル・時間でゲームが始まる', () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: '掛け算' }))
  fireEvent.click(screen.getByRole('button', { name: /Lv\.4/ }))
  fireEvent.click(screen.getByRole('button', { name: '30秒' }))
  expect(screen.getByRole('button', { name: '30秒' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'START' }))
  act(() => vi.advanceTimersByTime(3_000))

  const { expression } = createQuestionGenerator(() => 0.5)(4, 'multiplication')
  expect(screen.getByText(expression + ' =')).toBeTruthy()
  expect(screen.getByLabelText('残り時間').textContent).toBe('30')
})

test('ランキング画面を開いてモード選択に戻れる', () => {
  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: 'ランキング' }))
  expect(screen.getByRole('heading', { name: 'ランキング' })).toBeTruthy()

  fireEvent.click(screen.getByRole('button', { name: 'モード選択に戻る' }))
  expect(screen.getByRole('button', { name: 'START' })).toBeTruthy()
})

test('難易度選択画面でスコア計算と全レベルの出題範囲を確認できる', () => {
  render(<App />)

  const level = screen.getByRole('button', { name: /Lv\.4/ })
  const info = screen.getByRole('button', { name: 'スコア計算・出題範囲' })
  fireEvent.click(level)
  fireEvent.click(info)

  const dialog = within(screen.getByRole('dialog', { name: 'スコア計算・出題範囲' }))
  for (const label of ['基本点', '正確率係数', 'コンボ係数', 'ミス減点']) {
    expect(dialog.getByText(label, { selector: 'dt' })).toBeTruthy()
  }
  for (const level of [1, 2, 3, 4, 5]) {
    expect(dialog.getByRole('heading', { name: new RegExp(`^Lv\\.${level} `) })).toBeTruthy()
  }
  expect(dialog.getByText(/相手が10の倍数または11/)).toBeTruthy()
  expect(dialog.getByText(/答えは6桁以内/)).toBeTruthy()

  fireEvent.click(dialog.getByRole('button', { name: '閉じる' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(level.getAttribute('aria-pressed')).toBe('true')
})
