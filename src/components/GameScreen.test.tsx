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
  act(() => vi.advanceTimersByTime(50))
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
  act(() => vi.advanceTimersByTime(57_050))
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

  act(() => vi.advanceTimersByTime(30_050))
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

test.each([
  { duration: 30, showMonsterBattle: false, keypad: false, beforeDeadline: true },
  { duration: 30, showMonsterBattle: true, keypad: true, beforeDeadline: true },
  { duration: 'survival', showMonsterBattle: false, keypad: true, beforeDeadline: true },
  { duration: 30, showMonsterBattle: false, keypad: true, beforeDeadline: false },
] as const)('タイマーがゼロを表示した後に届いた確定（%o）', ({
  duration, showMonsterBattle, keypad, beforeDeadline,
}) => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.25)
  const { answer } = createQuestionGenerator()(1, 'addition')
  const onFinish = vi.fn()
  const durationMs = duration === 'survival' ? 20_000 : duration * 1000
  render(<GameScreen level={1} mode="addition" duration={duration} skipCountdown
    showMonsterBattle={showMonsterBattle} onFinish={onFinish} />)
  const deadline = performance.now() + durationMs
  const dispatchKey = (key: string, timeStamp: number) => {
    const event = keypad
      ? new MouseEvent('click', { bubbles: true })
      : new KeyboardEvent('keydown', { key, bubbles: true })
    Object.defineProperties(event, {
      isTrusted: { value: true },
      timeStamp: { value: timeStamp },
    })
    fireEvent(keypad ? screen.getByRole('button', { name: key }) : window, event)
  }
  if (!beforeDeadline) {
    for (const key of answer) fireEvent.keyDown(window, { key })
  }

  act(() => vi.advanceTimersByTime(durationMs + 10))
  expect(screen.getByRole('timer').textContent).toBe('0')
  act(() => {
    if (beforeDeadline) {
      for (const [index, key] of [...answer].entries()) {
        dispatchKey(key, deadline - answer.length - 1 + index)
      }
    }
    dispatchKey('Enter', deadline + (beforeDeadline ? -1 : 1))
  })
  if (showMonsterBattle) {
    expect(Boolean(document.querySelector('[data-attack="slash"]'))).toBe(beforeDeadline)
  } else {
    expect(screen.getByText(beforeDeadline ? '正解 1' : '正解 0')).toBeTruthy()
  }

  act(() => vi.advanceTimersByTime(90))
  if (duration === 'survival' && beforeDeadline) {
    expect(onFinish).not.toHaveBeenCalled()
    expect(screen.getByRole('timer').textContent).toBe('2')
    act(() => vi.advanceTimersByTime(2_000))
  }
  if (showMonsterBattle) finishReleaseWithoutInput()
  expect(onFinish).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    correctCount: beforeDeadline ? 1 : 0,
    reviewQuestions: beforeDeadline && duration !== 'survival'
      ? []
      : [expect.objectContaining({ outcome: 'timeout' })],
  }))
})

test('確定済みの誤答は時間切れ時にミスとして復習に残す', () => {
  vi.useFakeTimers()
  const onFinish = vi.fn()
  render(<GameScreen level={1} mode="addition" duration={30} skipCountdown onFinish={onFinish} />)
  act(() => vi.advanceTimersByTime(29_999))
  fireEvent.keyDown(window, { key: '0' })
  fireEvent.keyDown(window, { key: 'Enter' })

  act(() => vi.advanceTimersByTime(101))
  expect(onFinish).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    missCount: 1,
    reviewQuestions: [expect.objectContaining({ outcome: 'miss', wrongAnswers: ['0'] })],
  }))
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
  act(() => vi.advanceTimersByTime(30_050))

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
  act(() => vi.advanceTimersByTime(1_050))
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

test('討伐のチャージ・復習・時間切れの引き渡し', () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.25)
  const generate = createQuestionGenerator()
  let question = generate(1, 'addition')
  const submit = (answer: string) => {
    for (const key of answer) fireEvent.keyDown(window, { key })
    fireEvent.keyDown(window, { key: 'Enter' })
    question = generate(1, 'addition')
  }
  const onSound = vi.fn()
  const onFinish = vi.fn()
  const { container } = render(
    <GameScreen level={1} mode="addition" duration={30} skipCountdown showMonsterBattle
      onSound={onSound} onFinish={onFinish} />,
  )
  const arena = container.querySelector<HTMLElement>('.charge-arena')!
  const enemyCount = () => arena.querySelectorAll('.battle-enemy').length
  expect(enemyCount()).toBe(0)
  const missed = question

  submit('0')
  expect(screen.getByText(question.expression + ' =')).toBeTruthy()
  fireEvent.keyDown(window, { key: 'Tab' })
  expect(screen.getByText('正解：' + question.answer)).toBeTruthy()
  act(() => vi.advanceTimersByTime(1_000))
  question = generate(1, 'addition')
  const earlyEnemies = enemyCount()

  act(() => vi.advanceTimersByTime(3_001))
  const approachingEnemies = enemyCount()
  expect(approachingEnemies).toBeGreaterThan(earlyEnemies)
  submit(question.answer)
  expect(screen.queryByText('CRITICAL CHARGE!')).toBeNull()
  expect(enemyCount()).toBe(approachingEnemies - 1)
  const firstRing = [...arena.querySelectorAll('[data-attack="slash"]')].at(-1)
  expect(firstRing).not.toBeNull()

  act(() => vi.advanceTimersByTime(3_000))
  submit(question.answer)
  expect(screen.queryByText('CRITICAL CHARGE!')).toBeNull()
  expect([...arena.querySelectorAll('[data-attack="slash"]')].at(-1)).not.toBe(firstRing)
  expect(screen.getByText(question.expression + ' =')).toBeTruthy()
  expect(onSound).toHaveBeenCalledWith('slash', 1)
  expect(onSound).toHaveBeenCalledWith('slash', 2)

  act(() => vi.advanceTimersByTime(90_000))
  finishReleaseWithoutInput()
  expect(onFinish).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    correctCount: 2, maxCombo: 2, missCount: 2, score: 160,
    charge: { power: 38, criticalCount: 1 },
    reviewQuestions: expect.arrayContaining([
      { expression: missed.expression, answer: missed.answer, outcome: 'miss', wrongAnswers: ['0'] },
    ]),
  }))
})

test.each([
  [1, 3_000], [2, 4_000], [3, 5_000], [4, 7_000], [5, 10_000],
] as const)('Lv.%s の会心しきい値は %s ms', (level, threshold) => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.25)
  const generate = createQuestionGenerator()
  const onFinish = vi.fn()
  render(<GameScreen level={level} mode="addition" duration={30} skipCountdown showMonsterBattle onFinish={onFinish} />)

  for (const delay of [threshold + 1, threshold]) {
    act(() => vi.advanceTimersByTime(delay))
    const { answer } = generate(level, 'addition')
    for (const key of answer) fireEvent.keyDown(window, { key })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.queryByText('CRITICAL CHARGE!')).toBeNull()
  }
  act(() => vi.advanceTimersByTime(30_050 - (2 * threshold + 1)))
  finishReleaseWithoutInput()
  expect(onFinish).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    charge: { power: 38, criticalCount: 1 },
  }))
})

test('正解数を重ねても戦闘領域にチャージ色やオーラが出ない', () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.25)
  const generate = createQuestionGenerator()
  const { container } = render(
    <GameScreen level={1} mode="addition" duration={30} skipCountdown showMonsterBattle onFinish={vi.fn()} />,
  )
  const arena = container.querySelector<HTMLElement>('.charge-arena')!
  const keypad = screen.getByRole('group', { name: 'テンキー' })
  expect(arena.compareDocumentPosition(keypad) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  for (let count = 0; count <= 15; count++) {
    expect(arena.dataset.color).toBeUndefined()
    expect(arena.querySelector('.battle-hero-aura')).toBeNull()
    expect(screen.queryByText(/STAGE|体討伐|ボス戦/)).toBeNull()
    const { answer } = generate(1, 'addition')
    for (const key of answer) fireEvent.keyDown(window, { key })
    fireEvent.keyDown(window, { key: 'Enter' })
  }
})

test('討伐サバイバルでは制限時間がなく、HPゼロで解放せずに終了する', () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.25)
  const onFinish = vi.fn()
  render(<GameScreen level={1} mode="addition" duration="survival" skipCountdown showMonsterBattle onFinish={onFinish} />)
  const hp = () => Number(screen.getByRole('meter').getAttribute('value'))
  expect(hp()).toBe(100)
  expect(screen.queryByRole('timer')).toBeNull()
  act(() => vi.advanceTimersByTime(21_000))
  expect(hp()).toBeLessThan(100)
  expect(onFinish).not.toHaveBeenCalled()

  for (let i = 0; i < 10; i++) {
    fireEvent.keyDown(window, { key: '0' })
    fireEvent.keyDown(window, { key: 'Enter' })
  }
  expect(hp()).toBe(0)
  expect(screen.queryByRole('main', { name: '解放' })).toBeNull()
  expect(onFinish).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ battleOutcome: 'defeat' }))
})

test('パス中も敵が進み、次の正解で討伐コンボを引き継ぐ', () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.25)
  const generate = createQuestionGenerator()
  const onSound = vi.fn()
  const { container } = render(<GameScreen level={1} mode="addition" duration={30}
    skipCountdown showMonsterBattle onSound={onSound} onFinish={vi.fn()} />)
  const submit = (answer: string) => {
    for (const key of answer) fireEvent.keyDown(window, { key })
    fireEvent.keyDown(window, { key: 'Enter' })
  }
  submit(generate(1, 'addition').answer)
  generate(1, 'addition')
  act(() => vi.advanceTimersByTime(4_000))
  const enemy = container.querySelector<HTMLElement>('.battle-enemy')!
  const position = parseFloat(enemy.style.left)
  fireEvent.keyDown(window, { key: 'Tab' })
  act(() => vi.advanceTimersByTime(1_000))
  expect(parseFloat(enemy.style.left)).toBeLessThan(position)
  expect(screen.getByText('HP', { exact: true })).toBeTruthy()
  expect(screen.getByRole('meter', { name: 'HP' }).getAttribute('value')).toBe('100')
  submit(generate(1, 'addition').answer)
  expect(onSound).toHaveBeenCalledWith('slash', 2)
})

test('制限時間ちょうどの誤答でHPがゼロになると敗北する', () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.25)
  const onFinish = vi.fn()
  render(<GameScreen level={1} mode="addition" duration={1} skipCountdown showMonsterBattle onFinish={onFinish} />)
  const miss = () => {
    fireEvent.keyDown(window, { key: '0' })
    fireEvent.keyDown(window, { key: 'Enter' })
  }
  for (let i = 0; i < 9; i++) miss()
  act(() => vi.advanceTimersByTime(1_000))
  miss()
  expect(onFinish).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ battleOutcome: 'defeat' }))
  expect(screen.queryByRole('main', { name: '解放' })).toBeNull()
})

function finishReleaseWithoutInput() {
  act(() => vi.advanceTimersByTime(2_800))
}

test('時間切れ後に操作なしで超必殺技を発動し、全段階を経て終了する', () => {
  vi.useFakeTimers()
  const onFinish = vi.fn()
  const onSound = vi.fn()
  const { container } = render(
    <GameScreen level={1} mode="addition" duration={30} skipCountdown showMonsterBattle
      onSound={onSound} onFinish={onFinish} />,
  )

  act(() => vi.advanceTimersByTime(30_050))
  const scene = container.querySelector('.release-scene')
  expect(scene?.getAttribute('data-tier')).toBe('1')
  expect(scene?.getAttribute('data-phase')).toBe('blackout')
  expect(onSound).not.toHaveBeenCalledWith('timeUp')
  expect(screen.queryByRole('group', { name: 'テンキー' })).toBeNull()
  fireEvent.keyDown(window, { key: 'Enter' })
  for (const [ms, phase] of [[400, 'gather'], [600, 'slash'], [300, 'blast'], [700, 'aftermath']] as const) {
    act(() => vi.advanceTimersByTime(ms - 1))
    expect(scene?.getAttribute('data-phase')).not.toBe(phase)
    act(() => vi.advanceTimersByTime(1))
    expect(scene?.getAttribute('data-phase')).toBe(phase)
    expect(onFinish).not.toHaveBeenCalled()
  }
  expect(onSound.mock.calls.filter(([cue]) => cue === 'silence' || cue.startsWith('ultimate')))
    .toEqual([
      ['silence', 0.45], ['ultimateGather', 0.45], ['ultimateSlash', 0.45], ['ultimateBlast', 0.45],
    ])
  expect(screen.getByText('0 KO')).toBeTruthy()
  act(() => vi.advanceTimersByTime(800))
  expect(onFinish).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    score: 0, release: { koCount: 0, distanceKm: 0, tier: 1 },
  }))
})

test('スキップを繰り返しても完走時と同じ結果を一度だけ返す', () => {
  vi.useFakeTimers()
  const run = (skip: boolean) => {
    vi.spyOn(Math, 'random').mockReturnValue(0.25)
    const onFinish = vi.fn()
    const { unmount } = render(
      <GameScreen level={1} mode="addition" duration={30} skipCountdown showMonsterBattle onFinish={onFinish} />,
    )
    const generate = createQuestionGenerator()
    for (let index = 0; index < 10; index++) {
      for (const key of [...generate(1, 'addition').answer, 'Enter']) fireEvent.keyDown(window, { key })
    }
    act(() => vi.advanceTimersByTime(30_050))
    act(() => vi.advanceTimersByTime(400))
    expect(screen.getByText('強化解放')).toBeTruthy()
    if (skip) {
      const button = screen.getByRole('button', { name: 'スキップ' })
      fireEvent.click(button)
      fireEvent.click(button)
    }
    finishReleaseWithoutInput()
    expect(onFinish).toHaveBeenCalledTimes(1)
    unmount()
    return onFinish.mock.calls[0][0]
  }

  const completed = run(false)
  expect(completed.release.koCount).toBeGreaterThan(0)
  expect(run(true)).toEqual(completed)
})

test('討伐の誤答後と残り時間が少ないときに過充電が出ない', () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.25)
  const { container } = render(
    <GameScreen level={1} mode="addition" duration={30} skipCountdown showMonsterBattle onFinish={vi.fn()} />,
  )

  const expectNoOvercharge = () => {
    expect(screen.queryByText('危険！過充電')).toBeNull()
    expect(container.querySelector('[data-overcharged="true"], .charge-lightning')).toBeNull()
  }

  fireEvent.keyDown(window, { key: '0' })
  fireEvent.keyDown(window, { key: 'Enter' })
  expect(screen.getByRole('meter', { name: 'HP' }).getAttribute('value')).toBe('90')
  expectNoOvercharge()

  act(() => vi.advanceTimersByTime(20_000))
  expect(screen.getByRole('timer').textContent).toBe('10')
  expectNoOvercharge()
})

test('攻撃進化時も一時表示はコンボ数だけ', () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.25)
  const generate = createQuestionGenerator()
  let question = generate(1, 'addition')
  render(<GameScreen level={1} mode="addition" duration={30} skipCountdown showMonsterBattle onFinish={vi.fn()} />)

  const correct = () => {
    for (const key of question.answer) fireEvent.keyDown(window, { key })
    fireEvent.keyDown(window, { key: 'Enter' })
    question = generate(1, 'addition')
  }

  for (let i = 0; i < 4; i++) correct()
  expect(screen.queryByText(/攻撃進化/)).toBeNull()
  correct()
  expect(within(screen.getByRole('status')).getByText('5 COMBO')).toBeTruthy()
  expect(screen.queryByText(/攻撃進化/)).toBeNull()
  act(() => vi.advanceTimersByTime(1_500))
  expect(screen.queryByText('5 COMBO')).toBeNull()

  fireEvent.keyDown(window, { key: '0' })
  fireEvent.keyDown(window, { key: 'Enter' })
  for (let i = 0; i < 5; i++) correct()
  expect(screen.queryByText(/攻撃進化/)).toBeNull()
})

test('討伐の被弾音と通常攻撃音を鳴らし、消音時も判定と結果が一致する', () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.25)
  const run = (onSound?: (cue: string) => void) => {
    const onFinish = vi.fn()
    const { unmount } = render(<GameScreen level={1} mode="addition" duration={30}
      skipCountdown showMonsterBattle onSound={onSound} onFinish={onFinish} />)
    const generate = createQuestionGenerator()
    const submit = (answer: string) => {
      for (const key of [...answer, 'Enter']) fireEvent.keyDown(window, { key })
    }
    generate(1, 'addition')
    submit('0')
    expect(screen.getByRole('meter', { name: 'HP' }).getAttribute('value')).toBe('90')
    for (let i = 0; i < 20; i += 1) submit(generate(1, 'addition').answer)
    expect(screen.getByRole('meter', { name: 'HP' }).getAttribute('value')).toBe('90')
    act(() => vi.advanceTimersByTime(30_050))
    finishReleaseWithoutInput()
    expect(onFinish).toHaveBeenCalledOnce()
    const [result] = onFinish.mock.calls[0]
    unmount()
    return result
  }

  const onSound = vi.fn()
  const audible = run(onSound)
  expect(onSound).toHaveBeenCalledWith('damage')
  expect(onSound).toHaveBeenCalledWith('slash', 1)
  expect(onSound).toHaveBeenCalledWith('flying', 5)
  expect(onSound).toHaveBeenCalledWith('shockwave', 10)
  expect(onSound).toHaveBeenCalledWith('strongShockwave', 20)
  expect(onSound).not.toHaveBeenCalledWith('explosion')
  expect(onSound).not.toHaveBeenCalledWith('heal')
  expect(onSound).not.toHaveBeenCalledWith('incorrect')
  expect(run()).toEqual(audible)
})

test.each([
  { level: 2, answer: '0.2', automatic: true },
  { level: 3, answer: '-0.2', automatic: false },
] as const)('自動確定ONで $answer を入力する', ({ level, answer, automatic }) => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  expect(createQuestionGenerator()(level, 'addition').answer).toBe(answer)
  render(<GameScreen level={level} mode="addition" duration={30} skipCountdown autoConfirm onFinish={vi.fn()} />)
  const input = (key: string) => fireEvent.keyDown(window, { key })
  for (const key of answer.slice(0, -1)) input(key)
  expect(screen.getByText('正解 0')).toBeTruthy()
  input(answer.slice(-1))
  if (!automatic) {
    expect(screen.getByText('正解 0')).toBeTruthy()
    input('Enter')
  }
  expect(screen.getByText('正解 1')).toBeTruthy()
})
