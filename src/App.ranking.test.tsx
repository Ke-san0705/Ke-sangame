import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { App } from './App'

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  vi.stubEnv('VITE_SUPABASE_URL', 'https://ranking.example')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-key')
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const finish = () => act(() => vi.advanceTimersByTime(30_000))

test('任意の登録をRPCで行い、同じ条件のランキングを取得する', async () => {
  const entries: { id: number; nickname: string; score: number }[] = []
  const fetchRanking = vi.fn(async (url: string, options: RequestInit) => {
    if (url.endsWith('/submit_ranking_score')) {
      const submission = JSON.parse(String(options.body))
      entries.push({ id: 42, nickname: submission.p_nickname, score: 0 })
    }
    return Response.json(entries)
  })
  vi.stubGlobal('fetch', fetchRanking)
  render(<App />)
  click('掛け算')
  click('30秒')
  click('START')
  finish()

  const nickname = screen.getByRole('textbox', { name: 'ニックネーム' })
  fireEvent.change(nickname, { target: { value: 'ＳＨＩＴ' } })
  click('登録')
  expect(screen.getByRole('alert').textContent).toContain('使用できない')
  expect(fetchRanking).not.toHaveBeenCalled()

  fireEvent.change(nickname, { target: { value: ' 計算好き ' } })
  await act(async () => click('登録'))
  expect(fetchRanking).toHaveBeenNthCalledWith(1, 'https://ranking.example/rest/v1/rpc/submit_ranking_score', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({
      p_operation: 'multiply', p_level: 1, p_duration_seconds: 30,
      p_nickname: '計算好き', p_correct_count: 0, p_miss_count: 0,
      p_device_id: localStorage.getItem('ke-sangame:ranking-device'),
    }),
  }))
  expect(screen.getByText('登録しました。')).toBeTruthy()

  await act(async () => click('ランキングを見る'))
  expect(fetchRanking).toHaveBeenNthCalledWith(2, 'https://ranking.example/rest/v1/rpc/get_rankings', expect.objectContaining({
    body: JSON.stringify({ p_operation: 'multiply', p_level: 1, p_duration_seconds: 30 }),
  }))
  const row = screen.getByRole('row', { name: /1 計算好き 0 pt/ })
  expect(row.textContent).toContain('掛け算')
  expect(row.textContent).toContain('30秒')
})

test('プレイ中に切断して再接続した場合も自己ベストのみ保存する', () => {
  const fetchRanking = vi.fn()
  vi.stubGlobal('fetch', fetchRanking)
  const online = vi.spyOn(navigator, 'onLine', 'get')
  render(<App />)
  click('30秒')
  click('START')
  online.mockReturnValue(false)
  act(() => window.dispatchEvent(new Event('offline')))
  online.mockReturnValue(true)
  act(() => window.dispatchEvent(new Event('online')))
  finish()
  expect(screen.getByText('NEW RECORD!')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '登録' })).toBeNull()
  expect(localStorage.getItem('ke-sangame:personal-best:add:1:30')).toBe('0')
  expect(fetchRanking).not.toHaveBeenCalled()
})

test('未設定でもランキング画面から戻ってリプレイできる', () => {
  vi.stubEnv('VITE_SUPABASE_URL', '')
  const fetchRanking = vi.fn()
  vi.stubGlobal('fetch', fetchRanking)
  render(<App />)
  click('ランキング')
  expect(screen.getByText('ランキングは利用できません。')).toBeTruthy()
  click('モード選択に戻る')
  click('30秒')
  click('START')
  finish()
  expect(screen.getByText('NEW RECORD!')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '登録' })).toBeNull()
  click('もう一度遊ぶ')
  expect(screen.getByRole('timer').textContent).toBe('30')
  expect(fetchRanking).not.toHaveBeenCalled()
})
