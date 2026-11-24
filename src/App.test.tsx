import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { App } from './App'
import { createQuestionGenerator } from './lib/question-generator'
import { reactionLimit } from './lib/setsuna'
import { SETSUNA, setsunaFinishMs, setsunaStrongEnemy } from './lib/setsunaConfig'

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
  advance(22_550)

  expect(screen.getByRole('heading', { name: 'TIME UP!' })).toBeTruthy()
  expect(screen.getByText('60 pt')).toBeTruthy()
  expect(screen.getByText('電算見習い')).toBeTruthy()
  expect(screen.getByText('1 問')).toBeTruthy()
  expect(screen.queryByText(/体討伐/)).toBeNull()
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
  advance(30_050)
  expect(screen.getByText('時間切れ')).toBeTruthy()
})

test('再読み込み後も条件別の自己ベストを保持し、初回と上回ったときだけ通知する', () => {
  const { unmount } = render(<App />)
  click('掛け算')
  click('30秒')
  click('START')
  advance(3_000)
  advance(30_050)
  expect(screen.getByText('NEW RECORD!')).toBeTruthy()
  unmount()

  render(<App />)
  click('掛け算')
  click('30秒')
  click('START')
  advance(3_000)
  advance(30_050)
  expect(screen.queryByText('NEW RECORD!')).toBeNull()
  expect(screen.getByText('自己ベストとタイ記録')).toBeTruthy()

  click('もう1回')
  enter(first().answer)
  advance(30_050)
  expect(screen.getByText('120 pt')).toBeTruthy()
  expect(screen.getByText('NEW RECORD!')).toBeTruthy()

  click('もう1回')
  advance(30_050)
  expect(screen.queryByText('NEW RECORD!')).toBeNull()

  expect(screen.getByText('自己ベストまであと120点')).toBeTruthy()

  click('モード選択に戻る')
  expect(screen.getByRole('button', { name: '掛け算' }).getAttribute('aria-pressed')).toBe('true')
  click('60秒')
  click('START')
  advance(3_000)
  advance(60_050)
  expect(screen.getByText('NEW RECORD!')).toBeTruthy()
})

function stubAudio() {
  const createOscillator = vi.fn(() => ({
    frequency: { value: 0 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
    onended: undefined as (() => void) | undefined,
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
        disconnect: vi.fn(),
      }
    }
  })
  return createOscillator
}

function finishAudio(play: ReturnType<typeof stubAudio>) {
  for (const { value } of play.mock.results) value.onended?.()
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

  finishAudio(play)
  advance(24_999)
  expect(play).toHaveBeenCalledTimes(3)
  for (const expected of [4, 5, 6, 7, 8]) {
    advance(expected === 4 ? 1 : 1_000)
    expect(play).toHaveBeenCalledTimes(expected)
  }
  advance(1_050)
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
  const nextAnswer = () => {
    finishAudio(play)
    return generate(1, 'multiplication').answer
  }
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
  advance(30_050)
  click('もう1回')
  expect(screen.getByText('ベスト比 0問')).toBeTruthy()
  advance(30_050)
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
  advance(30_050)

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
  advance(28_050)

  click('もう1回')
  expect(screen.getByText('ベスト比 0問')).toBeTruthy()
  advance(1_000)
  enter(firstAnswer)
  expect(screen.getByText('ベスト比 +1問')).toBeTruthy()
  advance(1_000)
  expect(screen.getByText('ベスト比 0問')).toBeTruthy()
  enter(secondAnswer)
  advance(28_050)
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
  advance(28_050)

  click('もう1回')
  advance(2_000)
  expect(screen.getByText('ベスト比 −2問')).toBeTruthy()
  advance(28_050)
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
  advance(30_050)
  expect(screen.getByText('自己ベストまであと120点')).toBeTruthy()

  click('もう1回')
  advance(1_000)
  enter(first().answer)
  advance(29_050)
  expect(screen.getByText('自己ベストとタイ記録')).toBeTruthy()
  click('もう1回')
  advance(1_000)
  expect(screen.getByText('ベスト比 −1問')).toBeTruthy()
})


test('モンスター討伐モードの30秒でチャージ結果を表示し、再戦時にリセットする', () => {
  render(<App />)
  click('掛け算')
  click('モンスター討伐モード')
  click('30秒')
  click('START')
  advance(3_000)
  enter(first().answer)
  expect(document.querySelector('[data-attack="slash"]')).toBeTruthy()
  expect(screen.queryByText('CRITICAL CHARGE!')).toBeNull()
  advance(30_050)
  expect(screen.getByRole('main', { name: '解放' })).toBeTruthy()
  advance(2_800)
  expect(screen.getByRole('heading', { name: 'TIME UP!' })).toBeTruthy()
  expect(screen.getByText('チャージ量').nextElementSibling?.textContent).toBe('23')
  expect(screen.getByText('KO数').nextElementSibling?.textContent).toBe('230')
  expect(screen.getByText('飛距離').nextElementSibling?.textContent).toBe('2,645 km')
  expect(screen.getAllByText('新記録')).toHaveLength(2)
  click('もう1回')
  expect(document.querySelector('[data-attack]')).toBeNull()
  expect(screen.queryByText('CRITICAL CHARGE!')).toBeNull()
  advance(30_050)
  expect(screen.getByRole('main', { name: '解放' })).toBeTruthy()
  advance(2_800)
  expect(screen.getByText('チャージ量').nextElementSibling?.textContent).toBe('0')
  expect(screen.getByText('KO数').nextElementSibling?.textContent).toBe('0')
  expect(screen.getByText('飛距離').nextElementSibling?.textContent).toBe('0 km')
  expect(screen.queryByText('新記録')).toBeNull()
  click('モード選択に戻る')
  expect(screen.getByText('累計KO数 230')).toBeTruthy()
  expect(screen.getByText('最大飛距離 2,645 km')).toBeTruthy()
  expect(screen.getByText('地球爆破 0 回')).toBeTruthy()
  cleanup()
  render(<App />)
  expect(screen.getByText('累計KO数 230')).toBeTruthy()
})

test.each(['30秒', 'サバイバル'])('計算モードの%sでチャージ画面とチャージ結果を表示しない', (duration) => {
  render(<App />)
  expect(screen.getByRole('button', { name: '計算モード', pressed: true })).toBeTruthy()
  click('掛け算')
  click(duration)
  click('START')
  advance(3_000)
  enter(first().answer)
  expect(screen.getByText('正解 1')).toBeTruthy()
  expect(screen.queryAllByRole('img')).toHaveLength(0)
  expect(screen.queryByText('チャージ量')).toBeNull()
  advance(30_050)
  expect(screen.getByRole('heading', { name: 'TIME UP!' })).toBeTruthy()
  expect(screen.queryByText('チャージ量')).toBeNull()
  expect(screen.queryByText('KO数')).toBeNull()
  expect(screen.queryByText('飛距離')).toBeNull()
  expect(screen.queryByText('新記録')).toBeNull()
  expect(localStorage.getItem('ke-sangame:replay-records')).toBeNull()
})

test('選択した表示モードを次の起動時にも復元する', () => {
  const { unmount } = render(<App />)
  click('モンスター討伐モード')
  unmount()

  const next = render(<App />)
  expect(screen.getByRole('button', { name: 'モンスター討伐モード', pressed: true })).toBeTruthy()
  click('計算モード')
  next.unmount()

  render(<App />)
  expect(screen.getByRole('button', { name: '計算モード', pressed: true })).toBeTruthy()
})

test('完走とスキップで討伐記録を一度ずつ更新する', () => {
  render(<App />)
  click('掛け算')
  click('モンスター討伐モード')
  click('30秒')
  click('START')
  advance(3_000)

  function clearWithUltimate(skip: boolean) {
    const generate = createQuestionGenerator()
    for (let index = 0; index < 18; index++) enter(generate(1, 'multiplication').answer)
    advance(30_050)
    if (skip) click('スキップ')
    advance(2_800)
  }

  clearWithUltimate(false)
  expect(screen.getAllByText('新記録')).toHaveLength(3)
  expect(screen.getByText('地球爆破').nextElementSibling?.textContent).toBe('1 回')
  click('もう1回')
  clearWithUltimate(true)
  expect(screen.getAllByText('新記録')).toHaveLength(2)
  expect(within(screen.getByText('飛距離')).queryByText('新記録')).toBeNull()
  expect(screen.getByText('地球爆破').nextElementSibling?.textContent).toBe('2 回')
  click('モード選択に戻る')
  expect(screen.getByText('累計KO数 8,280')).toBeTruthy()
  expect(screen.getByText('最大飛距離 856,980 km')).toBeTruthy()
  expect(screen.getByText('地球爆破 2 回')).toBeTruthy()
})

test('刹那は6人抜きの先まで自動進行し、敗北後も自己ベストを保存する', () => {
  const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
  render(<App />)
  click('刹那')
  expect(screen.queryByRole('group', { name: '演算' })).toBeNull()
  click('初級')
  click('START')

  for (let round = 1; round <= 6; round++) {
    expect(screen.getByText(`第${round}戦`)).toBeTruthy()
    const cueTime = round * 3_000
    clock.mockReturnValue(cueTime)
    advance(2125)
    expect(screen.getByText('2 ＋ 2')).toBeTruthy()
    clock.mockReturnValue(cueTime + round * 10)
    if (round === 1) {
      click('4')
      expect(screen.queryByText('勝利')).toBeNull()
      click('Enter')
    } else {
      enter('4')
    }
    expect(screen.getByText('勝利')).toBeTruthy()
    advance(setsunaFinishMs)
    advance(SETSUNA.betweenRoundsMs)
  }

  advance(2125)
  expect(screen.getByText('第7戦')).toBeTruthy()
  advance(reactionLimit(6))
  expect(screen.getByText('CPUに先を越された')).toBeTruthy()
  expect(screen.getByText('6人抜き')).toBeTruthy()
  expect(screen.getByText('0.010秒')).toBeTruthy()
  expect(screen.queryByText(/ランキング/)).toBeNull()
  click('モード選択')
  expect(screen.getByText('6人')).toBeTruthy()
})

test('刹那では長押しを除き、合図前の2回の入力で敗北する', () => {
  render(<App />)
  click('自動で確定する')
  click('刹那')
  click('START')
  fireEvent.keyDown(window, { key: '4' })
  expect(screen.getByText('お手つき 1 / 2')).toBeTruthy()
  fireEvent.keyDown(window, { key: '4', repeat: true })
  expect(screen.queryByText('敗北')).toBeNull()
  click('4')
  expect(screen.getByText('お手つき2回')).toBeTruthy()
  expect(screen.getByText('0人抜き')).toBeTruthy()
  click('演出をスキップ')
  click('もう一度')
  expect(screen.getByText('合図を待て')).toBeTruthy()
  advance(2125)
  click('9')
  expect(screen.getByText('誤答')).toBeTruthy()
})

test('音量を変更し、ミュートの切り替えと再読み込み後も保持する', () => {
  const { unmount } = render(<App />)
  const slider = screen.getByRole<HTMLInputElement>('slider', { name: '音量' })
  fireEvent.change(slider, { target: { value: '35' } })
  expect(slider.value).toBe('35')
  click('ミュート')
  unmount()

  render(<App />)
  expect(screen.getByRole('button', { name: 'ミュート', pressed: true })).toBeTruthy()
  click('ミュート')
  expect(screen.getByRole<HTMLInputElement>('slider', { name: '音量' }).value).toBe('35')
})

test('刹那は合図と問題を同時表示し、決着後の対戦間だけ一時停止できる', () => {
  const clock = vi.spyOn(performance, 'now').mockReturnValue(1000)
  render(<App />)
  click('刹那')
  click('START')
  advance(2124)
  expect(screen.queryByText('！')).toBeNull()
  expect(screen.queryByText('2 ＋ 2')).toBeNull()
  expect(screen.queryByRole('button', { name: '一時停止' })).toBeNull()
  advance(1)
  expect(screen.getByText('！')).toBeTruthy()
  expect(screen.getByText('2 ＋ 2')).toBeTruthy()
  clock.mockReturnValue(1143)
  enter('4')
  expect(screen.getByText('0.143秒')).toBeTruthy()
  advance(setsunaFinishMs - 1)
  expect(screen.getByRole('button', { name: '演出をスキップ' })).toBeTruthy()
  advance(1)
  click('一時停止')
  fireEvent.keyDown(window, { key: '8' })
  advance(10_000)
  expect(screen.getByText('一時停止中')).toBeTruthy()
  expect(screen.getByText('0.143秒')).toBeTruthy()
  click('再開')
  advance(SETSUNA.betweenRoundsMs)
  fireEvent.keyDown(window, { key: 'Enter', repeat: true })
  expect(screen.getByText('第2戦')).toBeTruthy()
  expect(screen.getByText('合図を待て')).toBeTruthy()
  advance(2125)
  expect(screen.getByLabelText('入力した答え').textContent).toBe('')
  click('Enter')
  expect(screen.queryByText('誤答')).toBeNull()
})

test('刹那では連戦中のお手つきは累積するが、次戦の回答欄は空になる', () => {
  render(<App />)
  click('刹那')
  click('START')
  click('Enter')
  advance(2125)
  expect(screen.getByLabelText('入力した答え').textContent).toBe('')
  enter('4')
  click('演出をスキップ')
  advance(SETSUNA.betweenRoundsMs)
  expect(screen.getByText('お手つき 1 / 2')).toBeTruthy()
  click('Enter')
  expect(screen.getByText('お手つき2回')).toBeTruthy()
  expect(screen.getByText('1人抜き')).toBeTruthy()
})

test('刹那は開始前に選んだ難易度を連戦の2桁問題に反映する', () => {
  const clock = vi.spyOn(performance, 'now').mockReturnValue(1000)
  render(<App />)
  click('刹那')
  click('上級')
  click('START')
  for (let round = 0; round < 2; round++) {
    clock.mockReturnValue(1000 + round * 3000)
    advance(2125)
    enter('4')
    click('演出をスキップ')
    advance(SETSUNA.betweenRoundsMs)
  }
  advance(2125)
  expect(screen.getByText('3 ＋ 7')).toBeTruthy()
  click('1')
  click('9')
  fireEvent.keyDown(window, { key: 'Backspace' })
  click('0')
  expect(screen.getByLabelText('入力した答え').textContent).toBe('10')
  click('Enter')
  expect(screen.getByText('勝利')).toBeTruthy()
})

test.each(['誤答', 'お手つき2回', 'CPUに先を越された'])('刹那の%sでは敵剣士が一閃する', (reason) => {
  const clock = vi.spyOn(performance, 'now').mockReturnValue(1000)
  render(<App />)
  click('刹那')
  click('START')
  if (reason === 'お手つき2回') {
    click('Enter')
    click('Enter')
  } else {
    advance(2125)
    const deadline = 1000 + reactionLimit(0)
    clock.mockReturnValue(reason === '誤答' ? 1100 : deadline - 1)
    fireEvent.keyDown(window, { key: reason === '誤答' ? '9' : '4' })
    expect(screen.queryByText('敗北')).toBeNull()
    if (reason !== '誤答') clock.mockReturnValue(deadline)
    fireEvent.keyDown(window, { key: 'Enter' })
  }
  expect(screen.getByText(reason)).toBeTruthy()
  expect(document.querySelector('[data-duel-winner="opponent"]')).toBeTruthy()
  expect(screen.getByRole('button', { name: '演出をスキップ' })).toBeTruthy()
})

test('刹那の段位と強敵の解放を復元し、個別再戦の勝敗・最速を難易度別に保存する', () => {
  const clock = vi.spyOn(performance, 'now').mockReturnValue(1000)
  vi.mocked(Math.random).mockReturnValue(0)
  const { unmount } = render(<App />)
  click('刹那')
  fireEvent.click(screen.getByText('強敵・個別再戦'))
  expect(screen.getByText('？？？（未遭遇）')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '剣豪に再戦' })).toBeNull()
  click('START')

  for (let wins = 0; wins < setsunaStrongEnemy.afterWins; wins++) {
    advance(SETSUNA.wait.minMs)
    clock.mockReturnValue(performance.now() + 150)
    enter(wins < 3 ? '0' : '10')
    click('演出をスキップ')
    advance(SETSUNA.betweenRoundsMs)
  }
  expect(screen.getByRole('button', { name: '強敵戦を開始' })).toBeTruthy()
  // Leave before starting. Encountering the opponent is sufficient to unlock.
  unmount()

  const resumed = render(<App />)
  expect(screen.getByText('三段')).toBeTruthy()
  expect(screen.getByText('10人')).toBeTruthy()
  fireEvent.click(screen.getByText('強敵・個別再戦'))
  click('剣豪に再戦')
  click('強敵戦を開始')
  advance(SETSUNA.wait.minMs)
  enter('9')
  expect(screen.getByText('誤答')).toBeTruthy()
  expect(screen.getByText('0勝 1敗 ・ 最速 —')).toBeTruthy()
  click('演出をスキップ')
  click('もう一度')
  click('強敵戦を開始')
  advance(SETSUNA.wait.minMs)
  clock.mockReturnValue(performance.now() + 80)
  enter('10')
  advance(setsunaFinishMs + SETSUNA.betweenRoundsMs)
  expect(screen.getByText('1勝 1敗 ・ 最速 0.080秒')).toBeTruthy()
  resumed.unmount()

  render(<App />)
  expect(screen.getByText('無双')).toBeTruthy()
  expect(screen.getByText('10人')).toBeTruthy()
  expect(screen.getByText('0.150秒')).toBeTruthy()
  fireEvent.click(screen.getByText('強敵・個別再戦'))
  expect(screen.getByText('1勝 1敗 ・ 最速 0.080秒')).toBeTruthy()
  click('上級')
  expect(screen.getByText('無段')).toBeTruthy()
  expect(screen.getByText('0人')).toBeTruthy()
  expect(screen.getByText('？？？（未遭遇）')).toBeTruthy()
})

test.each(['計算モード', 'モンスター討伐モード'])('%sで設定の再読み込み後に桁数一致で自動確定する', (presentation) => {
  vi.mocked(Math.random).mockReturnValue(0.5)
  const { unmount } = render(<App />)
  const setting = () => screen.getByRole('button', { name: '自動で確定する' })
  expect(setting().getAttribute('aria-pressed')).toBe('false')
  fireEvent.click(setting())
  unmount()

  render(<App />)
  expect(setting().getAttribute('aria-pressed')).toBe('true')
  click(presentation)
  click('掛け算')
  const { answer, expression } = first()
  expect(answer.length).toBeGreaterThan(1)
  click('START')
  advance(3_000)

  for (const digit of answer.slice(0, -1)) click(digit)
  expect(screen.getByLabelText('入力した答え').textContent).toBe(answer.slice(0, -1))
  fireEvent.keyDown(window, { key: 'Backspace' })
  expect(screen.getByLabelText('入力した答え').textContent).toBe('')
  for (const digit of answer) click(digit)
  expect(screen.queryByText(expression + ' =')).toBeNull()
  fireEvent.keyDown(window, { key: 'Tab' })
  expect(screen.getByText(/^正解：/)).toBeTruthy()
})

test.each([true, false])('刹那の自動確定が %s のときに対応するキーでお手つきと回答を判定する', (autoConfirm) => {
  vi.mocked(Math.random).mockReturnValue(0)
  render(<App />)
  if (autoConfirm) click('自動で確定する')
  click('刹那')
  click('START')
  fireEvent.keyDown(window, { key: autoConfirm ? 'Enter' : '0' })
  expect(screen.getByText('合図を待て')).toBeTruthy()
  fireEvent.keyDown(window, { key: autoConfirm ? '0' : 'Enter' })
  expect(screen.getByText(`お手つき 1 / ${SETSUNA.maxFalseStarts}`)).toBeTruthy()
  advance(SETSUNA.wait.minMs)
  click('0')
  if (!autoConfirm) {
    expect(screen.queryByText('勝利')).toBeNull()
    click('Enter')
  }
  expect(screen.getByText('勝利')).toBeTruthy()
})
