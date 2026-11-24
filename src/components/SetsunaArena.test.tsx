import { cleanup, render } from '@testing-library/react'
import gsap from 'gsap'
import { afterEach, expect, it } from 'vitest'
import { SetsunaArena } from './SetsunaArena'

afterEach(cleanup)

it.each([
  ['player', 'opponent', -1, false],
  ['opponent', 'player', 1, false],
  ['player', 'opponent', -1, true],
] as const)('決着時は %s の相手が膝から崩れ、倒れた姿勢を維持する', (winner, loser, direction, strongEnemy) => {
  const { container, rerender } = render(<SetsunaArena {...{ winner, strongEnemy }} waiting={false} playing />)
  const fighter = container.querySelector<HTMLElement>(`[data-fighter="${loser}"]`)!
  const cell = fighter.firstElementChild as HTMLElement
  const standingFrame = cell.style.backgroundPosition
  const timeline = gsap.globalTimeline.getChildren(false, false, true).at(-1)!
  timeline.pause()
  const angle = () => parseFloat(fighter.style.getPropertyValue('--setsuna-defeat-angle'))
  const sink = () => parseFloat(fighter.style.getPropertyValue('--setsuna-defeat-sink'))

  expect(timeline.duration()).toBeCloseTo(0.8)
  timeline.time(0.37)
  expect(sink()).toBeGreaterThan(0)
  expect(angle()).toBe(0)
  timeline.time(0.54)
  expect(direction * angle()).toBeGreaterThan(0)
  expect(direction * angle()).toBeLessThan(45)
  timeline.time(0.8)
  expect(direction * angle()).toBeGreaterThan(75)
  expect(cell.style.backgroundPosition).toBe(standingFrame)
  const finalAngle = angle()

  rerender(<SetsunaArena {...{ winner, strongEnemy }} waiting={false} playing={false} />)
  const resultFighter = container.querySelector<HTMLElement>(`[data-fighter="${loser}"]`)!
  expect(parseFloat(resultFighter.style.getPropertyValue('--setsuna-defeat-angle'))).toBeCloseTo(finalAngle)
  expect((resultFighter.firstElementChild as HTMLElement).style.backgroundPosition).toBe(standingFrame)
})
