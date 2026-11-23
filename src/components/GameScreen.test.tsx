import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { createQuestionGenerator } from '../lib/question-generator'
import { durations, levels, type GameMode } from '../lib/gameMode'
import { App } from '../App'
import { GameScreen } from './GameScreen'

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const countdownModes = (Object.keys(levels).map(Number) as GameMode['level'][])
  .flatMap((level) => durations.map((duration) => ({ level, duration })))

test.each(countdownModes)('Lv.$level・$duration 秒の開始前に 3、2、1 を表示する', ({ level, duration }) => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.25)
  const first = createQuestionGenerator()(level, 'addition')
  const onFinish = vi.fn()
  render(<GameScreen level={level} mode="addition" duration={duration} onFinish={onFinish} />)

  for (const count of [3, 2, 1]) {
    expect(screen.getByRole('status').textContent).toBe(String(count))
    expect(screen.queryByRole('timer')).toBeNull()
    expect(screen.queryByText(first.expression + ' =')).toBeNull()
    fireEvent.keyDown(window, { key: 'Tab' })
    act(() => vi.advanceTimersByTime(1_000))
  }

  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByText(first.expression + ' =')).toBeTruthy()
  expect(screen.getByRole('timer').textContent).toBe(String(duration))
  expect(screen.getByText('ミス 0')).toBeTruthy()
  expect(within(screen.getByRole('group', { name: '暫定スコア' })).getByText('0')).toBeTruthy()
  act(() => vi.advanceTimersByTime((duration - 1) * 1_000))
  expect(screen.getByRole('timer').textContent).toBe('1')
  expect(onFinish).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(1_000))
  expect(screen.getByRole('timer').textContent).toBe('0')
  act(() => vi.advanceTimersByTime(1))
  expect(onFinish).toHaveBeenCalledTimes(1)
})

test('STARTからキーボードで回答し、時間切れで結果へ進む', () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.25)
  const first = createQuestionGenerator()(1, 'mix')
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'ミックス' }))
  fireEvent.click(screen.getByRole('button', { name: 'START' }))
  expect(screen.getByRole('status').textContent).toBe('3')
  act(() => vi.advanceTimersByTime(3_000))
  expect(screen.getByText(first.expression + ' =')).toBeTruthy()

  fireEvent.keyDown(document.body, { key: '9' })
  expect(fireEvent.keyDown(document.body, { key: 'Backspace' })).toBe(false)
  expect(screen.getByText('ミス 0')).toBeTruthy()
  expect(screen.getByLabelText('入力した答え').textContent).toBe('')

  fireEvent.keyDown(document.body, { key: '0' })
  fireEvent.keyDown(document.body, { key: 'Enter' })
  expect(screen.getByText('ミス 1')).toBeTruthy()
  expect(screen.getByText(first.expression + ' =')).toBeTruthy()
  expect(screen.getByLabelText('入力した答え').textContent).toBe('')

  for (const key of first.answer) fireEvent.keyDown(document.body, { key })
  expect(screen.getByText('正解 0')).toBeTruthy()
  fireEvent.keyDown(document.body, { key: 'Enter' })
  expect(screen.getByText('正解 1')).toBeTruthy()
  expect(screen.queryByText(first.expression + ' =')).toBeNull()

  expect(fireEvent.keyDown(document.body, { key: 'Tab' })).toBe(false)
  expect(screen.getByText('ミス 2')).toBeTruthy()
  expect(screen.getByRole('timer').textContent).toBe('57')
  act(() => vi.advanceTimersByTime(57_001))
  expect(screen.getByRole('heading', { name: 'TIME UP!' })).toBeTruthy()
  expect(screen.getByText('1 問')).toBeTruthy()
  expect(screen.getByText('2 回')).toBeTruthy()
  expect(fireEvent.keyDown(document.body, { key: 'Tab' })).toBe(true)
})

test('タッチ用テンキーで負数・小数を入力し、Cでミスを増やさず入力を消す', () => {
  vi.useFakeTimers()
  const onFinish = vi.fn()
  const { container } = render(
    <GameScreen level={3} mode="addition" duration={30} onFinish={onFinish} />,
  )
  act(() => vi.advanceTimersByTime(3_000))
  const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
  expect(container.querySelector('input, textarea, [contenteditable]')).toBeNull()

  for (const key of ['−', '1', '.', '5', '0']) press(key)
  expect(screen.getByLabelText('入力した答え').textContent).toBe('−1.50')
  press('C')
  expect(screen.getByLabelText('入力した答え').textContent).toBe('')
  expect(screen.getByText('ミス 0')).toBeTruthy()

  act(() => vi.advanceTimersByTime(28_000))
  press('pass')
  expect(screen.getByRole('status').textContent).toMatch(/^正解：/)
  expect(onFinish).not.toHaveBeenCalled()
  act(() => vi.advanceTimersByTime(1_000))
  expect(onFinish).toHaveBeenCalledExactlyOnceWith({
    correctCount: 0, missCount: 1, accuracy: 0, score: -20, averageAnswerSeconds: 0,
    paceCurve: Array(31).fill(0),
    maxCombo: 0, basePoints: 170, accuracyCoefficient: 1, comboCoefficient: 1,
    reviewQuestions: [expect.objectContaining({ expression: expect.any(String), answer: expect.any(String), outcome: 'pass' })],
  })
})

test('Lv.2の小数問題にテンキーで末尾ゼロを付けて正解できる', () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  const { answer } = createQuestionGenerator()(2, 'addition')
  render(<GameScreen level={2} mode="addition" duration={30} onFinish={vi.fn()} />)
  act(() => vi.advanceTimersByTime(3_000))
  expect(answer).toContain('.')
  expect(screen.queryByRole('button', { name: '−' })).toBeNull()
  for (const key of answer + '0') fireEvent.click(screen.getByRole('button', { name: key }))
  fireEvent.click(screen.getByRole('button', { name: 'Enter' }))
  expect(screen.getByText('正解 1')).toBeTruthy()
})

test.each([
  { timing: 'タイマーより先', offset: 0, scheduleBeforeStart: true, expected: 1 },
  { timing: 'タイマーより後', offset: 0, scheduleBeforeStart: false, expected: 1 },
  { timing: '締切直前', offset: -1, scheduleBeforeStart: false, expected: 1 },
  { timing: '締切後', offset: 1, scheduleBeforeStart: false, expected: 0 },
  { timing: '画面テンキー', offset: 0, scheduleBeforeStart: false, expected: 1 },
  { timing: '未確定', offset: null, scheduleBeforeStart: false, expected: 0 },
])('時間切れ時の集計（$timing）', ({ timing, offset, scheduleBeforeStart, expected }) => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.25)
  const { answer } = createQuestionGenerator()(1, 'addition')
  const onFinish = vi.fn()
  const submit = () => {
    if (timing === '画面テンキー') {
      fireEvent.click(screen.getByRole('button', { name: 'Enter' }))
    } else {
      fireEvent.keyDown(window, { key: 'Enter' })
    }
  }
  if (scheduleBeforeStart) window.setTimeout(submit, 33_000)

  render(<GameScreen level={1} mode="addition" duration={30} onFinish={onFinish} />)
  act(() => vi.advanceTimersByTime(3_000))
  for (const key of answer) fireEvent.keyDown(window, { key })
  if (!scheduleBeforeStart && offset !== null) window.setTimeout(submit, 30_000 + offset)

  act(() => vi.advanceTimersByTime(30_002))
  expect(onFinish).toHaveBeenCalledExactlyOnceWith({
    correctCount: expected,
    paceCurve: [...Array(30).fill(0), expected],
    missCount: 0,
    accuracy: expected,
    score: expected * 120,
    maxCombo: expected,
    basePoints: 100,
    accuracyCoefficient: expected ? 1.2 : 1,
    comboCoefficient: 1,
    reviewQuestions: expected && offset === 0
      ? []
      : [expect.objectContaining({ outcome: 'timeout', answer: expect.any(String) })],
    averageAnswerSeconds: expected ? (30_000 + (offset ?? 0)) / 1000 : 0,
  })
})

test.each(['不正解', 'パス'])('%sで連続正解が途切れ、セッションの最大コンボを使う', (miss) => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.25)
  const generate = createQuestionGenerator()
  let question = generate(1, 'addition')
  const onFinish = vi.fn()
  render(<GameScreen level={1} mode="addition" duration={30} onFinish={onFinish} />)
  act(() => vi.advanceTimersByTime(3_000))

  const enter = (answer: string) => {
    for (const key of answer) fireEvent.keyDown(window, { key })
    fireEvent.keyDown(window, { key: 'Enter' })
  }
  const correct = () => {
    enter(question.answer)
    question = generate(1, 'addition')
  }
  for (let i = 0; i < 6; i++) correct()
  expect(within(screen.getByRole('group', { name: '暫定スコア' })).getByText('792')).toBeTruthy()
  if (miss === 'パス') {
    fireEvent.keyDown(window, { key: 'Tab' })
    act(() => vi.advanceTimersByTime(1_000))
    question = generate(1, 'addition')
  } else {
    enter('0')
  }
  expect(within(screen.getByRole('group', { name: '暫定スコア' })).getByText('640')).toBeTruthy()
  for (let i = 0; i < 5; i++) correct()
  expect(within(screen.getByRole('group', { name: '暫定スコア' })).getByText('1,311')).toBeTruthy()
  act(() => vi.advanceTimersByTime(30_002))

  expect(onFinish).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    correctCount: 11, missCount: 1, maxCombo: 6, comboCoefficient: 1.1, score: 1311,
  }))
})

test.each([30, 60, 'survival'] as const)('残り10秒で警告色になり、5秒から毎秒鳴る（%s）', (duration) => {
  vi.useFakeTimers()
  const onSound = vi.fn()
  const { container } = render(
    <GameScreen level={1} mode="addition" duration={duration} skipCountdown onSound={onSound} onFinish={vi.fn()} />,
  )
  const timer = screen.getByRole('timer', { name: '残り時間' })
  const fill = container.querySelector<HTMLElement>('.game-timer-fill')
  const initialSeconds = duration === 'survival' ? 20 : duration
  expect(fill?.style.width).toBe('100%')
  act(() => vi.advanceTimersByTime((initialSeconds - 11) * 1_000))
  expect(timer.textContent).toBe('11')
  expect(fill?.dataset.time).not.toBe('low')
  act(() => vi.advanceTimersByTime(1_000))
  expect(timer.textContent).toBe('10')
  expect(fill?.dataset.time).toBe('low')
  expect(Number.parseFloat(fill?.style.width ?? '')).toBeCloseTo(1000 / initialSeconds)

  act(() => vi.advanceTimersByTime(4_000))
  expect(timer.textContent).toBe('6')
  expect(onSound).not.toHaveBeenCalled()
  for (let second = 5; second >= 1; second--) {
    act(() => vi.advanceTimersByTime(1_000))
    expect(timer.textContent).toBe(String(second))
    expect(onSound).toHaveBeenCalledTimes(6 - second)
    expect(onSound).toHaveBeenLastCalledWith('countdown')
  }
  act(() => vi.advanceTimersByTime(1_001))
  expect(onSound).toHaveBeenCalledTimes(6)
  expect(onSound).toHaveBeenLastCalledWith('timeUp')
})

test('ベスト比の表示中も幅に合わせて問題文と入力を縮小する', () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.25)
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const scale = Number(this.style.getPropertyValue('--game-text-scale') || 1)
    return new DOMRect(0, 0, 200 * scale, 20)
  })
  const { expression } = createQuestionGenerator()(1, 'addition')
  render(
    <GameScreen level={1} mode="addition" duration={30} skipCountdown
      bestCurve={Array(31).fill(0)} onFinish={vi.fn()} />,
  )

  const question = screen.getByText(expression + ' =')
  expect(question.style.getPropertyValue('--game-text-scale')).toBe('0.5')
  for (const key of '1234567890') fireEvent.keyDown(window, { key })
  const answer = screen.getByLabelText('入力した答え')
  expect(answer.textContent).toBe('1234567890')
  expect(answer.style.getPropertyValue('--game-text-scale')).toBe('0.5')
  expect(screen.getByText('ベスト比 0問')).toBeTruthy()
})

test.each([30, 'survival'] as const)('正解ごとに討伐し、10体目のボスを挟んで通常の順番に戻る（%s）', (duration) => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.25)
  const generate = createQuestionGenerator()
  const next = () => generate(1, 'addition')
  const enter = (answer: string) => {
    for (const key of answer) fireEvent.keyDown(window, { key })
    fireEvent.keyDown(window, { key: 'Enter' })
  }
  const target = () => screen.getByRole('img', { name: /^(モンスター|ボス)：/ })
  render(<GameScreen level={1} mode="addition" duration={duration} skipCountdown showMonsterBattle onFinish={vi.fn()} />)

  expect(screen.getByRole('img', { name: '勇者' }).getAttribute('src')).toMatch(/\/monsters\/hero\.png$/)
  expect(screen.getByText('0体討伐')).toBeTruthy()
  expect(target().getAttribute('src')).toMatch(/\/slime\.png$/)
  enter('0')
  expect(screen.getByText('0体討伐')).toBeTruthy()
  expect(target().getAttribute('src')).toMatch(/\/slime\.png$/)
  fireEvent.keyDown(window, { key: 'Tab' })
  act(() => vi.advanceTimersByTime(1_000))
  next()
  expect(screen.getByText('0体討伐')).toBeTruthy()
  expect(target().getAttribute('src')).toMatch(/\/slime\.png$/)

  const following = [
    'mushroom', 'tiger-cub', 'goblin', 'wolf', 'treant', 'skeleton', 'dark-mage', 'gargoyle',
    'baby-dragon', 'hellhound', 'reaper', 'dragon', 'slime',
  ]
  for (const [index, sprite] of following.entries()) {
    enter(next().answer)
    expect(screen.getByText(`${index + 1}体討伐`)).toBeTruthy()
    expect(target().getAttribute('src')).toBe(`${import.meta.env.BASE_URL}monsters/${sprite}.png`)
    if (sprite === 'baby-dragon') expect(screen.getByRole('img', { name: /^ボス：/ })).toBe(target())
  }

  let count = following.length
  for (const [defeated, boss] of [[19, 'wood-golem'], [29, 'death-knight'], [39, 'demon-king'], [49, 'baby-dragon']] as const) {
    for (; count < defeated; count++) {
      enter(next().answer)
    }
    expect(screen.getByRole('img', { name: /^ボス：/ }).getAttribute('src')).toBe(
      `${import.meta.env.BASE_URL}monsters/${boss}.png`,
    )
  }
})
