import { useEffect, useState } from 'react'
import { operations, type GameMode } from '../lib/gameMode'

const basicOperations = ['add', 'subtract', 'multiply', 'divide'] as const

// Opening examples bridge mode selection until the game screen and generator are integrated.
const openingOperands = {
  add: [[8, 7], [114, 32], [1234, 321], [2134, 1526], [8345, 1438]],
  subtract: [[18, 7], [114, 32], [1234, 321], [2134, 1526], [8345, 1438]],
  multiply: [[8, 7], [14, 12], [124, 32], [236, 104], [1234, 234]],
  divide: [[56, 7], [112, 7], [420, 12], [1728, 24], [8064, 112]],
} as const

type GameStartScreenProps = {
  mode: GameMode
  startedAt: number
  onBack: () => void
}

export function GameStartScreen({ mode, startedAt, onBack }: GameStartScreenProps) {
  const [remaining, setRemaining] = useState<number>(mode.duration)
  const operation = mode.operation === 'mix'
    ? basicOperations[startedAt % basicOperations.length]
    : mode.operation
  const [left, right] = openingOperands[operation][mode.level - 1]

  useEffect(() => {
    const interval = window.setInterval(() => {
      const seconds = Math.max(0, Math.ceil((startedAt + mode.duration * 1000 - Date.now()) / 1000))
      setRemaining(seconds)
      if (seconds === 0) window.clearInterval(interval)
    }, 100)
    return () => window.clearInterval(interval)
  }, [mode.duration, startedAt])

  return (
    <main className="secondary-screen">
      <progress aria-label="制限時間の進行" value={remaining} max={mode.duration} />
      <div aria-label="残り時間">{remaining}</div>
      <h1>{remaining > 0 ? `${left} ${operations[operation].symbol} ${right} =` : 'TIME UP!'}</h1>
      <button type="button" onClick={onBack}>モード選択に戻る</button>
    </main>
  )
}
