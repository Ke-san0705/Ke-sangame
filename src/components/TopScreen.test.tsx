import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { App } from '../App'
import { createQuestionGenerator } from '../lib/question-generator'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

test('既定の足し算・初級・60秒で1タップで開始できる', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  render(<App />)

  expect(screen.getByRole('heading', { level: 1, name: '計算無双' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'START' }))

  const { expression } = createQuestionGenerator(() => 0.5)(1, 'addition')
  expect(screen.getByText(expression + ' =')).toBeTruthy()
  expect(screen.getByLabelText('残り時間').textContent).toBe('60')
})

test('選んだ演算・レベル・時間でゲームが始まる', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: '掛け算' }))
  fireEvent.click(screen.getByRole('button', { name: /Lv\.4/ }))
  fireEvent.click(screen.getByRole('button', { name: '30秒' }))
  expect(screen.getByRole('button', { name: '30秒' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'START' }))

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
