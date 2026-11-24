import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { GameScreen, type GameResult } from './components/GameScreen'
import { RankingScreen } from './components/RankingScreen'
import { ResultScreen } from './components/ResultScreen'
import { readPersonalBestCurve, savePersonalBest } from './lib/personalBest'
import { SetsunaScreen } from './components/SetsunaScreen'
import { TopScreen } from './components/TopScreen'
import {
  defaultMode, readGamePresentation, saveGamePresentation, type GameMode, type PlayMode,
} from './lib/gameMode'
import { createSoundEffects, readMuted, readVolume, saveMuted, saveVolume } from './lib/soundEffects'
import { readReplayRecords, saveReplayRecords } from './lib/replayRecords'
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
  | { name: 'setsuna'; attempt: number }
  | { name: 'game'; mode: PlayMode; skipCountdown: boolean; bestCurve?: number[] }
  | { name: 'result'; mode: PlayMode; result: GameResult; personalBest: ReturnType<typeof savePersonalBest>; replayRecords: ReturnType<typeof saveReplayRecords>; playedOnline: boolean }
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
  const [volume, setVolume] = useState(readVolume)
  const [sound] = useState(() => createSoundEffects(volume))
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

  const startSetsuna = (attempt = 0) => {
    if (!muted) sound.unlock()
    setScreen({ name: 'setsuna', attempt })
  }

  if (screen.name === 'setsuna') {
    return (
      <SetsunaScreen
        key={screen.attempt}
        onBack={goBack}
        onReplay={() => startSetsuna(screen.attempt + 1)}
        onSound={muted ? undefined : sound.play}
      />
    )
  }

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
          const replayRecords = presentation === 'monster' && result.release
            ? saveReplayRecords(result.release)
            : undefined
          setScreen({
            name: 'result', mode: gameMode, result, personalBest, replayRecords,
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
        personalBest={screen.personalBest}
        replayRecords={screen.replayRecords}
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
      replayRecords={readReplayRecords()}
      presentation={presentation}
      onPresentationChange={(selection) => {
        setPresentation(selection)
        saveGamePresentation(selection)
      }}
      volume={volume}
      onVolumeChange={(value) => {
        setVolume(value)
        sound.setVolume(value)
        saveVolume(value)
      }}
      muted={muted}
      onToggleMute={() => {
        setMuted(!muted)
        saveMuted(!muted)
        if (!muted) sound.play('silence')
      }}
      onModeChange={setMode}
      onStart={() => presentation === 'setsuna' ? startSetsuna() : startGame(mode)}
      onRanking={() => setScreen({ name: 'ranking', mode: featuredRankingMode })}
    />
  )
}
