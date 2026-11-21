import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { TopScreen } from './TopScreen'

afterEach(cleanup)

test('仮トップ画面にゲーム名を表示する', () => {
  render(<TopScreen />)

  expect(screen.getByRole('heading', { level: 1, name: '計算無双' })).toBeTruthy()
})
