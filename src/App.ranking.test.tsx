import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { App } from './App'
import { createQuestionGenerator } from './lib/question-generator'

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
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms))
const finish = () => advance(30_001)

test('トップから看板種目を表示し、ドロップダウンで条件を切り替えられる', async () => {
  const fetchRanking = vi.fn(async (_url: string, options: RequestInit) => {
    const { p_operation, p_level, p_duration_seconds } = JSON.parse(String(options.body))
    return Response.json([{ id: 1, nickname: `${p_operation}-${p_level}-${p_duration_seconds}`, score: 100 }])
  })
  vi.stubGlobal('fetch', fetchRanking)
  render(<App />)
  click('掛け算')
  click('30秒')

  await act(async () => click('ランキング'))
  expect(fetchRanking).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('row', { name: /1 mix-1-60 100 pt ミックス Lv\.1 60秒/ })).toBeTruthy()

  for (const [label, value, nickname] of [
    ['レベル', '2', 'mix-2-60'],
    ['演算', 'subtract', 'subtract-2-60'],
    ['制限時間', '120', 'subtract-2-120'],
  ]) {
    await act(async () => fireEvent.change(screen.getByRole('combobox', { name: label }), { target: { value } }))
    expect(screen.getByRole('rowheader', { name: nickname })).toBeTruthy()
  }
})

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
  advance(3_000)
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
      p_nickname: '計算好き', p_correct_count: 0, p_miss_count: 0, p_max_combo: 0,
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
  advance(3_000)
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
  advance(3_000)
  finish()
  expect(screen.getByText('NEW RECORD!')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '登録' })).toBeNull()
  click('もう一度遊ぶ')
  advance(3_000)
  expect(screen.getByRole('timer').textContent).toBe('30')
  expect(fetchRanking).not.toHaveBeenCalled()
})

test('サバイバルは選択したレベルで遊べ、時間を延長して正解数の自己ベストだけを保存する', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.25)
  const fetchRanking = vi.fn()
  vi.stubGlobal('fetch', fetchRanking)
  const { unmount } = render(<App />)
  const selectSurvival = () => {
    click('掛け算')
    click('Lv.2\u3000中級')
    click('サバイバル')
    click('START')
    advance(3_000)
  }
  selectSurvival()
  const timer = () => screen.getByRole('timer').textContent
  expect(timer()).toBe('20')
  const generate = createQuestionGenerator()
  const first = generate(2, 'multiplication')
  expect(screen.getByText(first.expression + ' =')).toBeTruthy()
  fireEvent.keyDown(window, { key: '0' })
  fireEvent.keyDown(window, { key: 'Enter' })
  expect(timer()).toBe('20')
  click('pass')
  expect(timer()).toBe('20')
  expect(screen.getByText('ミス 2')).toBeTruthy()
  advance(1_000)

  for (let count = 1; count <= 60; count += 1) {
    const { answer } = generate(2, 'multiplication')
    for (const key of answer) fireEvent.keyDown(window, { key })
    fireEvent.keyDown(window, { key: 'Enter' })
    if (count === 1) expect(timer()).toBe('21')
    if (count === 29) expect(timer()).toBe('77')
    if (count === 30) expect(timer()).toBe('78')
    if (count === 59 || count === 60) expect(timer()).toBe('107')
  }

  advance(106_999)
  expect(timer()).toBe('1')
  advance(2)
  expect(screen.getByRole('heading', { name: 'TIME UP!' })).toBeTruthy()
  expect(screen.getByText('自己ベスト').nextElementSibling?.textContent).toBe('60 問')
  expect(screen.getByText('NEW RECORD!')).toBeTruthy()
  expect(screen.queryByRole('textbox', { name: 'ニックネーム' })).toBeNull()
  expect(fetchRanking).not.toHaveBeenCalled()
  unmount()

  render(<App />)
  selectSurvival()
  advance(20_001)
  expect(screen.getByText('自己ベスト').nextElementSibling?.textContent).toBe('60 問')
  expect(screen.queryByText('NEW RECORD!')).toBeNull()
})
