import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { GameScreen, type GameResult } from './components/GameScreen'
import { RankingScreen } from './components/RankingScreen'
import { ResultScreen } from './components/ResultScreen'
import { savePersonalBest } from './lib/personalBest'
import { TopScreen } from './components/TopScreen'
import { defaultMode, type GameMode } from './lib/gameMode'
import { createSoundEffects, readMuted, saveMuted } from './lib/soundEffects'
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
  | { name: 'result'; mode: GameMode; result: GameResult; isNewRecord: boolean; playedOnline: boolean }
  | { name: 'ranking'; mode: GameMode }

function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

const isOnline = () => navigator.onLine

export function App() {
  const [muted, setMuted] = useState(readMuted)
  const [sound] = useState(createSoundEffects)
  useEffect(() => sound.dispose, [sound])

  const [mode, setMode] = useState(defaultMode)
  const [screen, setScreen] = useState<Screen>({ name: 'top' })
  const online = useSyncExternalStore(subscribeOnline, isOnline)
  const playedOnline = useRef(false)
  useEffect(() => {
    const markOffline = () => { playedOnline.current = false }
    window.addEventListener('offline', markOffline)
    return () => window.removeEventListener('offline', markOffline)
  }, [])

  const startGame = (gameMode: GameMode) => {
    if (!muted) sound.unlock()
    playedOnline.current = isOnline()
    setScreen({ name: 'game', mode: gameMode })
  }
  const goBack = () => setScreen({ name: 'top' })

  if (screen.name === 'game') {
    const gameMode = screen.mode
    return (
      <GameScreen
        level={gameMode.level}
        mode={questionModes[gameMode.operation]}
        duration={gameMode.duration}
        onSound={muted ? undefined : sound.play}
        onFinish={(result) => {
          const isNewRecord = savePersonalBest(gameMode, result.score)
          setScreen({
            name: 'result', mode: gameMode, result, isNewRecord,
            playedOnline: playedOnline.current && isOnline(),
          })
        }}
      />
    )
  }

  if (screen.name === 'result') {
    return (
      <ResultScreen
        result={screen.result}
        isNewRecord={screen.isNewRecord}
        mode={screen.mode}
        playedOnline={screen.playedOnline}
        online={online}
        onViewRanking={() => setScreen({ name: 'ranking', mode: screen.mode })}
        onReplay={() => startGame(screen.mode)}
        onBack={goBack}
      />
    )
  }

  if (screen.name === 'ranking') {
    return <RankingScreen initialMode={screen.mode} online={online} onBack={goBack} />
  }

  return (
    <TopScreen
      mode={mode}
      muted={muted}
      onToggleMute={() => {
        setMuted(!muted)
        saveMuted(!muted)
      }}
      onModeChange={setMode}
      onStart={() => startGame(mode)}
      onRanking={() => setScreen({ name: 'ranking', mode })}
    />
  )
}
