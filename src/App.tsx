import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { GameScreen, type GameResult } from './components/GameScreen'
import { RankingScreen } from './components/RankingScreen'
import { ResultScreen } from './components/ResultScreen'
import { readPersonalBestCurve, savePersonalBest } from './lib/personalBest'
import { TopScreen } from './components/TopScreen'
import {
  defaultMode, readGamePresentation, saveGamePresentation, type GameMode, type PlayMode,
} from './lib/gameMode'
import { createSoundEffects, readMuted, saveMuted } from './lib/soundEffects'
import type { QuestionMode } from './lib/question-generator'

const featuredRankingMode: GameMode = { operation: 'mix', level: 1, duration: 60 }

const questionModes = {
  add: 'addition',
  subtract: 'subtraction',
  multiply: 'multiplication',
  divide: 'division',
  mix: 'mix',
} satisfies Record<GameMode['operation'], QuestionMode>

type Screen =
  | { name: 'top' }
  | { name: 'game'; mode: PlayMode; skipCountdown: boolean; bestCurve?: number[] }
  | { name: 'result'; mode: PlayMode; result: GameResult; personalBest: ReturnType<typeof savePersonalBest>; playedOnline: boolean }
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

  const [presentation, setPresentation] = useState(readGamePresentation)
  const [mode, setMode] = useState<PlayMode>(defaultMode)
  const [screen, setScreen] = useState<Screen>({ name: 'top' })
  const online = useSyncExternalStore(subscribeOnline, isOnline)
  const playedOnline = useRef(false)
  useEffect(() => {
    const markOffline = () => { playedOnline.current = false }
    window.addEventListener('offline', markOffline)
    return () => window.removeEventListener('offline', markOffline)
  }, [])

  const startGame = (gameMode: PlayMode, skipCountdown = false) => {
    if (!muted) sound.unlock()
    playedOnline.current = isOnline()
    setScreen({ name: 'game', mode: gameMode, skipCountdown, bestCurve: readPersonalBestCurve(gameMode) })
  }
  const goBack = () => setScreen({ name: 'top' })

  if (screen.name === 'game') {
    const gameMode = screen.mode
    return (
      <GameScreen
        showMonsterBattle={presentation === 'monster'}
        level={gameMode.level}
        mode={questionModes[gameMode.operation]}
        duration={gameMode.duration}
        skipCountdown={screen.skipCountdown}
        bestCurve={screen.bestCurve}
        onSound={muted ? undefined : sound.play}
        onFinish={(result) => {
          const personalBest = savePersonalBest(
            gameMode, gameMode.duration === 'survival' ? result.correctCount : result.score, result.paceCurve,
          )
          setScreen({
            name: 'result', mode: gameMode, result, personalBest,
            playedOnline: playedOnline.current && isOnline(),
          })
        }}
      />
    )
  }

  if (screen.name === 'result') {
    return (
      <ResultScreen
        showMonsterBattle={presentation === 'monster'}
        result={screen.result}
        personalBest={screen.personalBest}
        mode={screen.mode}
        playedOnline={screen.playedOnline}
        online={online}
        onViewRanking={(mode) => setScreen({ name: 'ranking', mode })}
        onReplay={() => startGame(screen.mode, true)}
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
      presentation={presentation}
      onPresentationChange={(selection) => {
        setPresentation(selection)
        saveGamePresentation(selection)
      }}
      muted={muted}
      onToggleMute={() => {
        setMuted(!muted)
        saveMuted(!muted)
      }}
      onModeChange={setMode}
      onStart={() => startGame(mode)}
      onRanking={() => setScreen({ name: 'ranking', mode: featuredRankingMode })}
    />
  )
}
