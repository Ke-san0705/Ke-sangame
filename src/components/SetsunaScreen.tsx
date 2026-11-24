import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { createDuel, formatReaction, judgeDuel, reactionLimits, saveSetsunaBest } from '../lib/setsuna'
import type { SoundCue } from '../lib/soundEffects'
import { flushSync } from 'react-dom'
import { SETSUNA, setsunaFinishMs } from '../lib/setsunaConfig'
import { useReducedEffects } from '../lib/useEffectTimeline'
import { SetsunaArena } from './SetsunaArena'
import { GameKeypad, gameKey } from './GameKeypad'
import './SetsunaScreen.css'

const digits = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0']
const lossLabels = { wrong: '誤答', slow: 'CPUに先を越された', falseStart: 'お手つき2回' }

type RoundResult = { outcome: 'win' | keyof typeof lossLabels; reactionMs: number | null }

type SetsunaScreenProps = {
  onBack: () => void
  onReplay: () => void
  onSound?: (cue: SoundCue) => void
}

export function SetsunaScreen({ onBack, onReplay, onSound }: SetsunaScreenProps) {
  const [enemy, setEnemy] = useState(0)
  const [duel, setDuel] = useState(createDuel)
  const [signal, setSignal] = useState(false)
  const [earlyCount, setEarlyCount] = useState(0)
  const [submittedAnswer, setSubmittedAnswer] = useState('')
  const [result, setResult] = useState<RoundResult | null>(null)
  const [best, setBest] = useState<ReturnType<typeof saveSetsunaBest> | null>(null)
  const [finishPlaying, setFinishPlaying] = useState(false)
  const reducedEffects = useReducedEffects()
  const playing = finishPlaying && !reducedEffects
  const roundStart = useRef(0)
  const signalTime = useRef<number | null>(null)
  const earlyInputs = useRef(0)
  const settled = useRef(false)

  const playSound = useEffectEvent((cue: SoundCue) => onSound?.(cue))
  const waiting = !signal && result === null
  useEffect(() => {
    if (!waiting) return
    playSound('heartbeat')
    const pulse = window.setInterval(() => playSound('heartbeat'), SETSUNA.heartbeatIntervalMs)
    const reveal = window.setTimeout(() => {
      if (settled.current) return
      // Commit the equation and cue in the same task that starts the reaction clock.
      signalTime.current = performance.now()
      flushSync(() => setSignal(true))
      playSound('duelSignal')
    }, duel.waitMs)
    return () => {
      window.clearInterval(pulse)
      window.clearTimeout(reveal)
    }
  }, [duel, waiting])

  useEffect(() => {
    if (!playing) return
    const slash = window.setTimeout(() => playSound('slash'), SETSUNA.finish.stepMs)
    const finish = window.setTimeout(() => setFinishPlaying(false), setsunaFinishMs)
    return () => {
      window.clearTimeout(slash)
      window.clearTimeout(finish)
    }
  }, [playing])

  function handleAnswer(key: string, eventTime = performance.now()) {
    if (settled.current || eventTime < roundStart.current) return
    const elapsed = signalTime.current === null ? -1 : eventTime - signalTime.current
    const outcome = judgeDuel(Number(key), duel.answer, elapsed, enemy, earlyInputs.current)
    if (outcome === 'early') {
      earlyInputs.current += 1
      setEarlyCount(earlyInputs.current)
      return
    }

    settled.current = true
    onSound?.('silence')
    if (signalTime.current !== null) setSubmittedAnswer(key)
    const reactionMs = outcome === 'win' || outcome === 'slow' ? elapsed : null
    setResult({ outcome, reactionMs })
    setFinishPlaying(!reducedEffects)
    setBest(saveSetsunaBest(reactionMs, outcome === 'win' ? enemy + 1 : enemy))
  }

  const handleKeyboard = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape' && playing && !event.repeat) {
      event.preventDefault()
      setFinishPlaying(false)
      return
    }
    const key = gameKey(event)
    if (!key || !digits.includes(key)) return
    event.preventDefault()
    if (!event.repeat) handleAnswer(key, event.isTrusted ? event.timeStamp : undefined)
  })

  useEffect(() => {
    roundStart.current = performance.now()
    const onKeyDown = (event: KeyboardEvent) => handleKeyboard(event)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function nextDuel() {
    roundStart.current = performance.now()
    signalTime.current = null
    settled.current = false
    setFinishPlaying(false)
    setEnemy(enemy + 1)
    setDuel(createDuel())
    setSignal(false)
    setSubmittedAnswer('')
    setResult(null)
  }

  const won = result?.outcome === 'win'
  const cleared = won && enemy + 1 === reactionLimits.length
  const finished = result && (!won || cleared)

  return (
    <main className="setsuna-screen battle-screen" data-outcome={result ? (won ? 'win' : 'loss') : undefined}>
      <header className="setsuna-header">
        <button type="button" onClick={onBack}>モード選択</button>
        <h1>刹那</h1>
        <span>{enemy + 1} / {reactionLimits.length}</span>
      </header>
      <SetsunaArena key={enemy} waiting={waiting} winner={result ? (won ? 'player' : 'opponent') : null} playing={playing} />
      <div className="game-problem setsuna-problem">
        <div className="setsuna-message" role="status">
          {result ? (
            <>
              <strong>{cleared ? 'クリア' : won ? '勝利' : '敗北'}</strong>
              {result.reactionMs !== null && (
                <span className="setsuna-reaction">{formatReaction(result.reactionMs)}</span>
              )}
              {result.outcome !== 'win' && <span>{lossLabels[result.outcome]}</span>}
            </>
          ) : (
            <strong className="setsuna-equation">
              {signal ? <><span className="setsuna-signal">！</span><span>{duel.expression}</span></>
                : earlyCount ? 'お手つき 1 / 2' : '合図を待て'}
            </strong>
          )}
        </div>
        {(!result || submittedAnswer) && (
          <span className="game-answer" aria-label="入力した答え">{submittedAnswer}</span>
        )}
      </div>
      <div className="setsuna-controls">
        {result ? (
          <div className="setsuna-actions">
            {finished ? (
              <>
                <p>{won ? enemy + 1 : enemy}人抜き</p>
                {best && <SetsunaRecords best={best} />}
                <button type="button" disabled={playing} onClick={onReplay}>もう一度</button>
              </>
            ) : (
              <button type="button" disabled={playing} onClick={nextDuel}>次の相手</button>
            )}
            <div className="setsuna-skip">
              {playing && <button type="button" onClick={() => setFinishPlaying(false)}>演出をスキップ</button>}
            </div>
          </div>
        ) : (
          <>
            <GameKeypad keys={digits} onKey={handleAnswer} />
            <p className="setsuna-key-hint">数字キーで回答</p>
          </>
        )}
      </div>
    </main>
  )
}

export function SetsunaRecords({ best }: { best: ReturnType<typeof saveSetsunaBest> }) {
  return (
    <dl className="setsuna-records">
      <div><dt>最速反応時間</dt><dd>{best.fastestMs === null ? '—' : formatReaction(best.fastestMs)}</dd></div>
      <div><dt>最高到達人数</dt><dd>{best.defeated}人</dd></div>
    </dl>
  )
}
