import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { createDuel, formatReaction, judgeDuel, reactionLimit, saveSetsunaBest } from '../lib/setsuna'
import { SETSUNA, setsunaFinishMs, type SetsunaDifficulty } from '../lib/setsunaConfig'
import type { SoundCue } from '../lib/soundEffects'
import { useReducedEffects } from '../lib/useEffectTimeline'
import { SetsunaArena } from './SetsunaArena'
import { GameKeypad, gameKey } from './GameKeypad'
import './SetsunaScreen.css'

const keys = ['7', '8', '9', 'C', '4', '5', '6', '1', '2', '3', 'Enter', '0']
const lossLabels = { wrong: '誤答', slow: 'CPUに先を越された', falseStart: `お手つき${SETSUNA.maxFalseStarts}回` }

type RoundResult = { outcome: 'win' | keyof typeof lossLabels; reactionMs: number | null }
type SetsunaScreenProps = {
  difficulty: SetsunaDifficulty
  onBack: () => void
  onReplay: () => void
  onSound?: (cue: SoundCue) => void
}

export function SetsunaScreen({ difficulty, onBack, onReplay, onSound }: SetsunaScreenProps) {
  const [enemy, setEnemy] = useState(0)
  const [duel, setDuel] = useState(() => createDuel(difficulty, 0))
  const [signal, setSignal] = useState(false)
  const [earlyCount, setEarlyCount] = useState(0)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<RoundResult | null>(null)
  const [best, setBest] = useState<ReturnType<typeof saveSetsunaBest> | null>(null)
  const [finishPlaying, setFinishPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const reducedEffects = useReducedEffects()
  const playing = finishPlaying && !reducedEffects
  const waiting = !signal && result === null
  const won = result?.outcome === 'win'
  const cpuLimit = reactionLimit(enemy)
  const roundStart = useRef(0)
  const signalTime = useRef<number | null>(null)
  const earlyInputs = useRef(0)
  const answerBuffer = useRef('')
  const settled = useRef(false)

  const playSound = useEffectEvent((cue: SoundCue) => onSound?.(cue))
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

  function settle(outcome: RoundResult['outcome'], reactionMs: number | null = null) {
    if (settled.current) return
    settled.current = true
    onSound?.('silence')
    setResult({ outcome, reactionMs })
    setFinishPlaying(!reducedEffects)
    setBest(saveSetsunaBest(reactionMs, outcome === 'win' ? enemy + 1 : enemy))
  }

  const cpuWins = useEffectEvent(() => settle('slow'))
  useEffect(() => {
    if (!signal || result || signalTime.current === null) return
    const remainingMs = signalTime.current + cpuLimit - performance.now()
    const timer = window.setTimeout(cpuWins, Math.max(0, Math.ceil(remainingMs)))
    return () => window.clearTimeout(timer)
  }, [signal, result, cpuLimit])

  useEffect(() => {
    if (!playing) return
    const slash = window.setTimeout(() => playSound('slash'), SETSUNA.finish.stepMs)
    const finish = window.setTimeout(() => setFinishPlaying(false), setsunaFinishMs)
    return () => {
      window.clearTimeout(slash)
      window.clearTimeout(finish)
    }
  }, [playing])

  const nextDuel = useEffectEvent(() => {
    roundStart.current = performance.now()
    signalTime.current = null
    answerBuffer.current = ''
    settled.current = false
    setEnemy(enemy + 1)
    setDuel(createDuel(difficulty, enemy + 1))
    setSignal(false)
    setAnswer('')
    setFinishPlaying(false)
    setResult(null)
  })
  useEffect(() => {
    if (!won || playing || paused) return
    const timer = window.setTimeout(() => flushSync(nextDuel), SETSUNA.betweenRoundsMs)
    return () => window.clearTimeout(timer)
  }, [won, playing, paused])

  function handleKey(key: string, eventTime = performance.now()) {
    if (settled.current || eventTime < roundStart.current) return
    const elapsed = signalTime.current === null ? -1 : eventTime - signalTime.current
    if (key === 'C' || key === 'Backspace') {
      answerBuffer.current = key === 'C' ? '' : answerBuffer.current.slice(0, -1)
      setAnswer(answerBuffer.current)
      return
    }
    if (elapsed < 0) {
      const outcome = judgeDuel(null, duel.answer, elapsed, cpuLimit, earlyInputs.current)
      if (outcome === 'early') {
        earlyInputs.current += 1
        setEarlyCount(earlyInputs.current)
      } else {
        settle('falseStart')
      }
      return
    }
    if (elapsed >= cpuLimit) {
      settle('slow')
      return
    }
    if (key === 'Enter') {
      if (!answerBuffer.current) return
      const outcome = judgeDuel(Number(answerBuffer.current), duel.answer, elapsed, cpuLimit)
      settle(outcome === 'win' ? 'win' : 'wrong', outcome === 'win' ? elapsed : null)
      return
    }
    if (answerBuffer.current.length < SETSUNA.question.maxInputLength) {
      answerBuffer.current += key
      setAnswer(answerBuffer.current)
    }
  }

  const handleKeyboard = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape' && !event.repeat && (playing || won)) {
      event.preventDefault()
      if (playing) setFinishPlaying(false)
      else if (won) setPaused(!paused)
      return
    }
    const key = gameKey(event)
    if (!key || !keys.includes(key)) return
    if (key === 'Enter' && !event.repeat && (settled.current || !answerBuffer.current)
      && event.target instanceof Element
      && event.target.closest('button:not(.game-key)')) return
    event.preventDefault()
    if (!event.repeat) handleKey(event.key === 'Backspace' ? 'Backspace' : key, event.isTrusted ? event.timeStamp : undefined)
  })

  useEffect(() => {
    roundStart.current = performance.now()
    const onKeyDown = (event: KeyboardEvent) => handleKeyboard(event)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <main className="setsuna-screen battle-screen" data-outcome={result ? (won ? 'win' : 'loss') : undefined}>
      <header className="setsuna-header">
        <button type="button" onClick={() => { onSound?.('silence'); onBack() }}>モード選択</button>
        <h1>刹那</h1>
        <span>第{enemy + 1}戦</span>
      </header>
      <SetsunaArena key={enemy} waiting={waiting} winner={result ? (won ? 'player' : 'opponent') : null} playing={playing} />
      <div className="game-problem setsuna-problem">
        <div className="setsuna-message" role="status">
          {result ? (
            <>
              <strong>{won ? '勝利' : '敗北'}</strong>
              {result.reactionMs !== null && (
                <span className="setsuna-reaction">{formatReaction(result.reactionMs)}</span>
              )}
              {result.outcome !== 'win' && <span>{lossLabels[result.outcome]}</span>}
              {paused && <span>一時停止中</span>}
            </>
          ) : (
            <strong className="setsuna-equation">
              {signal ? <><span className="setsuna-signal">！</span><span>{duel.expression}</span></>
                : earlyCount ? `お手つき ${earlyCount} / ${SETSUNA.maxFalseStarts}` : '合図を待て'}
            </strong>
          )}
        </div>
        {(!result || answer) && (
          <span className="game-answer" aria-label="入力した答え">{answer}</span>
        )}
      </div>
      <div className="setsuna-controls">
        {result ? (
          <div className="setsuna-actions">
            <p>{won ? enemy + 1 : enemy}人抜き</p>
            {won ? (
              <button type="button" onClick={() => setPaused(!paused)}>{paused ? '再開' : '一時停止'}</button>
            ) : (
              <>
                {best && <SetsunaRecords best={best} />}
                <button type="button" disabled={playing} onClick={onReplay}>もう一度</button>
              </>
            )}
            <div className="setsuna-skip">
              {playing && <button type="button" onClick={() => setFinishPlaying(false)}>演出をスキップ</button>}
            </div>
          </div>
        ) : (
          <>
            <GameKeypad keys={keys} onKey={handleKey} />
            <p className="setsuna-key-hint">数字キーで入力・Enterで確定</p>
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
