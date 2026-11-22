import { useState } from 'react'
import { GameScreen, type GameResult } from './components/GameScreen'
import { ResultScreen } from './components/ResultScreen'
import { savePersonalBest } from './lib/personalBest'
import { TopScreen } from './components/TopScreen'
import { defaultMode, type GameMode } from './lib/gameMode'
import type { QuestionMode } from './lib/question-generator'

const questionModes = {
  add: 'addition',
  subtract: 'subtraction',
  multiply: 'multiplication',
  divide: 'division',
  mix: 'mix',
} satisfies Record<GameMode['operation'], QuestionMode>

type Screen =
  | { name: 'top' }
  | { name: 'game'; mode: GameMode }
  | { name: 'result'; mode: GameMode; result: GameResult; isNewRecord: boolean }
  | { name: 'ranking' }

export function App() {
  const [mode, setMode] = useState(defaultMode)
  const [screen, setScreen] = useState<Screen>({ name: 'top' })
  const goBack = () => setScreen({ name: 'top' })

  if (screen.name === 'game') {
    const gameMode = screen.mode
    return (
      <GameScreen
        level={gameMode.level}
        mode={questionModes[gameMode.operation]}
        duration={gameMode.duration}
        onFinish={(result) => {
          const isNewRecord = savePersonalBest(gameMode, result.score)
          setScreen({ name: 'result', mode: gameMode, result, isNewRecord })
        }}
      />
    )
  }

  if (screen.name === 'result') {
    return (
      <ResultScreen
        result={screen.result}
        isNewRecord={screen.isNewRecord}
        onReplay={() => setScreen({ name: 'game', mode: screen.mode })}
        onBack={goBack}
      />
    )
  }

  if (screen.name === 'ranking') {
    return (
      <main className="secondary-screen">
        <h1>ランキング</h1>
        <p>ランキングは準備中です。</p>
        <button type="button" onClick={goBack}>モード選択に戻る</button>
      </main>
    )
  }

  return (
    <TopScreen
      mode={mode}
      onModeChange={setMode}
      onStart={() => setScreen({ name: 'game', mode })}
      onRanking={() => setScreen({ name: 'ranking' })}
    />
  )
}
