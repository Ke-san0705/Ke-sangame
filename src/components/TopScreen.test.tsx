import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { TopScreen } from './TopScreen'

test('仮トップ画面にゲーム名を表示する', () => {
  expect(renderToStaticMarkup(<TopScreen />)).toContain('<h1>計算無双</h1>')
})
