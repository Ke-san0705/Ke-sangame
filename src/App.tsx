import { useState } from 'react'
import { GameStartScreen } from './components/GameStartScreen'
import { TopScreen } from './components/TopScreen'
import { defaultMode, type GameMode } from './lib/gameMode'

type Screen =
  | { name: 'top' }
  | { name: 'game'; mode: GameMode; startedAt: number }
  | { name: 'ranking' }

export function App() {
  const [mode, setMode] = useState(defaultMode)
  const [screen, setScreen] = useState<Screen>({ name: 'top' })
  const goBack = () => setScreen({ name: 'top' })

  if (screen.name === 'game') {
    return <GameStartScreen mode={screen.mode} startedAt={screen.startedAt} onBack={goBack} />
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
      onStart={() => setScreen({ name: 'game', mode, startedAt: Date.now() })}
      onRanking={() => setScreen({ name: 'ranking' })}
    />
  )
}
