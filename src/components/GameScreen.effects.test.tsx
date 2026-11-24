import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import gsap from 'gsap'
import { afterEach, expect, test, vi } from 'vitest'
import { createQuestionGenerator } from '../lib/question-generator'
import { GameScreen } from './GameScreen'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function motionPreference(query: string) {
  const preference = new EventTarget()
  return Object.assign(preference, { matches: false, media: query })
}

function play({ lowPower = false, reduced = false, slow = false, takeDamage = false } = {}) {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.25)
  const preference = motionPreference('(prefers-reduced-motion: reduce)')
  const slowDisplay = motionPreference('(update: slow)')
  preference.matches = reduced
  slowDisplay.matches = slow
  vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
    (query === preference.media ? preference : slowDisplay) as MediaQueryList,
  )
  const onFinish = vi.fn()
  const timersBeforeMount = vi.getTimerCount()
  const view = render(<GameScreen level={1} duration={30} mode="addition" skipCountdown
    showMonsterBattle lowPower={lowPower} onFinish={onFinish} />)
  const game = screen.getByRole('main', { name: 'ゲーム' })
  const arena = game.querySelector('.battle-camera')!
  const { answer } = createQuestionGenerator()(1, 'addition')
  for (const key of [...answer, 'Enter']) fireEvent.keyDown(window, { key })
  if (takeDamage) {
    for (const key of ['0', 'Enter']) fireEvent.keyDown(window, { key })
  }
  const tweens = () => gsap.getTweensOf(arena)
  return { ...view, preference, onFinish, timersBeforeMount, tweens, game }
}

test('解放画面に移ると戦闘のタイムラインと入力処理を破棄する', () => {
  const { tweens, timersBeforeMount, unmount, onFinish } = play({ takeDamage: true })
  expect(tweens().length).toBeGreaterThan(0)
  const [tween] = tweens()
  // Keep a visual effect in progress until the game clock switches screens.
  tween.parent?.pause()
  act(() => vi.advanceTimersByTime(30_050))
  expect(screen.getByRole('main', { name: '解放' })).toBeTruthy()
  expect(tweens()).toHaveLength(0)
  expect(fireEvent.keyDown(window, { key: 'Tab' })).toBe(true)
  // Only the release screen's phase timeout should remain.
  expect(vi.getTimerCount()).toBe(timersBeforeMount + 1)
  unmount()
  expect(vi.getTimerCount()).toBe(timersBeforeMount)
  act(() => vi.advanceTimersByTime(60_000))
  expect(onFinish).not.toHaveBeenCalled()
})

test.each([{ lowPower: true }, { reduced: true }, { slow: true }])('演出を抑制しても正解を判定する (%j)', (options) => {
  const { tweens, onFinish } = play(options)
  expect(tweens()).toHaveLength(0)
  expect(screen.queryByText('CRITICAL CHARGE!')).toBeNull()

  act(() => vi.advanceTimersByTime(30_050))
  act(() => vi.advanceTimersByTime(1_300))
  const release = screen.getByRole('main', { name: '解放' })
  expect(release.getAttribute('data-phase')).toBe('blast')
  expect(release.getAttribute('data-reduced')).toBe('true')
  expect(release.querySelectorAll('.release-spark')).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'スキップ' }))
  expect(onFinish).toHaveBeenCalledOnce()
  expect(onFinish.mock.calls[0][0]).toMatchObject({ correctCount: 1, charge: { power: 23 } })
})

test('実行中に視差効果を減らす設定に切り替えると演出を破棄する', () => {
  const { preference, tweens } = play({ takeDamage: true })
  expect(tweens().length).toBeGreaterThan(0)
  preference.matches = true
  act(() => preference.dispatchEvent(new Event('change')))
  expect(tweens()).toHaveLength(0)
})

test('matchMedia がない環境でもゲームを開始できる', () => {
  vi.stubGlobal('matchMedia', undefined)
  render(<GameScreen level={1} duration={30} mode="addition" skipCountdown showMonsterBattle onFinish={vi.fn()} />)
  expect(screen.getByRole('timer').textContent).toBe('30')
})

test('HUD・問題・入力欄はカメラの外に固定する', () => {
  const { game, tweens } = play({ takeDamage: true })
  const camera = game.querySelector('.battle-camera')!
  expect(tweens()).toHaveLength(1)
  for (const selector of ['.battle-hud', '.game-expression', '.game-answer', '.game-keypad']) {
    const element = game.querySelector(selector)
    expect(element).toBeTruthy()
    expect(camera.contains(element)).toBe(false)
    expect(gsap.getTweensOf(element).length).toBe(0)
  }
  expect(screen.getByRole('meter', { name: 'HP' }).textContent).toBe('')
  expect(screen.getByText('討伐数')).toBeTruthy()
})

test('連続正解で攻撃が進化し、重ねるエフェクトは上限内に収まる', () => {
  const { game } = play()
  const generate = createQuestionGenerator()
  generate(1, 'addition')
  for (let i = 1; i < 12; i++) {
    const { answer } = generate(1, 'addition')
    for (const key of [...answer, 'Enter']) fireEvent.keyDown(window, { key })
  }
  expect(screen.getByText('12 COMBO')).toBeTruthy()
  expect(game.querySelector('[data-attack="shockwave"]')).toBeTruthy()
  expect(game.querySelectorAll('[data-attack]').length).toBeLessThanOrEqual(3)
})


test('10コンボでもHPは回復せず、通常攻撃だけを表示する', () => {
  const { game } = play()
  const generate = createQuestionGenerator()
  generate(1, 'addition')
  for (const key of ['0', 'Enter']) fireEvent.keyDown(window, { key })
  generate(1, 'addition')
  const hp = screen.getByRole('meter', { name: 'HP' })
  expect(hp.getAttribute('value')).toBe('90')

  for (let combo = 1; combo <= 10; combo++) {
    const { answer } = generate(1, 'addition')
    for (const key of [...answer, 'Enter']) fireEvent.keyDown(window, { key })
    if (combo < 10) expect(hp.getAttribute('value')).toBe('90')
  }

  expect(hp.getAttribute('value')).toBe('90')
  expect(screen.getByText('10 COMBO')).toBeTruthy()
  expect(screen.queryByText('+10 HP')).toBeNull()
  expect(game.querySelector('[data-attack="shockwave"]')).toBeTruthy()
  fireEvent.keyDown(window, { key: 'Enter' })
  expect(game.querySelectorAll('[data-attack="comboSpecial"]')).toHaveLength(0)
})

test('解放の収束と爆発で粒子スロットを再利用する', () => {
  play()
  act(() => vi.advanceTimersByTime(30_050))
  const scene = screen.getByRole('main', { name: '解放' })
  act(() => vi.advanceTimersByTime(400))
  const sparks = [...scene.querySelectorAll('.release-spark')]
  expect(sparks).toHaveLength(16)
  act(() => vi.advanceTimersByTime(900))
  expect(scene.getAttribute('data-phase')).toBe('blast')
  const blastSparks = [...scene.querySelectorAll('.release-spark')]
  expect(blastSparks).toHaveLength(sparks.length)
  expect(blastSparks.every((spark, index) => spark === sparks[index])).toBe(true)
})

test('敵が消えた後に次の敵が同じ描画スロットを使う', () => {
  const { game } = play()
  act(() => vi.advanceTimersByTime(2_500))
  const sprite = game.querySelector('.battle-enemy')!
  expect(sprite.getAttribute('data-enemy')).toBe('slime')
  act(() => vi.advanceTimersByTime(2_000))
  const generate = createQuestionGenerator()
  generate(1, 'addition')
  const { answer } = generate(1, 'addition')
  for (const key of [...answer, 'Enter']) fireEvent.keyDown(window, { key })
  expect(sprite.getAttribute('data-enemy')).toBe('goblin')
  expect(game.querySelector('.battle-enemy')).toBe(sprite)
})
