import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { DEFAULT_AUTO_CONFIRM, matchesAnswerDigitCount } from '../lib/autoConfirm'
import { createDuel, formatReaction, judgeDuel, reactionLimit, readSetsunaBest, saveSetsunaBest } from '../lib/setsuna'
import { SETSUNA, setsunaFinishMs, setsunaStrongEnemy, type SetsunaDifficulty } from '../lib/setsunaConfig'
import { readStrongEnemy, rollsStrongEnemy, saveStrongEnemy, setsunaRank } from '../lib/setsunaProgress'
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
  rematch?: boolean
  autoConfirm?: boolean
  onBack: () => void
  onReplay: () => void
  onSound?: (cue: SoundCue) => void
}

export function SetsunaScreen({ difficulty, rematch = false, autoConfirm = DEFAULT_AUTO_CONFIRM, onBack, onReplay, onSound }: SetsunaScreenProps) {
  const [defeated, setDefeated] = useState(0)
  const [strongEnemy, setStrongEnemy] = useState(rematch)
  const [ready, setReady] = useState(rematch)
  const [duel, setDuel] = useState(() => createDuel(difficulty, rematch ? setsunaStrongEnemy.afterWins : 0))
  const missedRolls = useRef(0)
  const [signal, setSignal] = useState(false)
  const [earlyCount, setEarlyCount] = useState(0)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<RoundResult | null>(null)
  const [best, setBest] = useState(() => readSetsunaBest(difficulty))
  const [strongRecord, setStrongRecord] = useState(() => readStrongEnemy(difficulty))
  const [finishPlaying, setFinishPlaying] = useState(false)
  const [paused, setPaused] = useState(false)
  const reducedEffects = useReducedEffects()
  const playing = finishPlaying && !reducedEffects
  const waiting = !ready && !signal && result === null
  const won = result?.outcome === 'win'
  const cpuLimit = strongEnemy ? setsunaStrongEnemy.reactionMs : reactionLimit(defeated)
  const roundStart = useRef(0)
  const signalTime = useRef<number | null>(null)
  const earlyInputs = useRef(0)
  const answerBuffer = useRef('')
  const settled = useRef(false)

  const playSound = useEffectEvent((cue: SoundCue) => onSound?.(cue))
  useEffect(() => () => playSound('silence'), [])
  useEffect(() => {
    if (strongEnemy) playSound('duelStrongEnemy')
  }, [strongEnemy])

  useEffect(() => {
    if (!waiting) return
    const ambience = () => {
      if (settled.current || signalTime.current !== null) return
      playSound('duelWind')
      playSound('heartbeat')
    }
    const reveal = window.setTimeout(() => {
      if (settled.current) return
      // Commit the equation and cue in the same task that starts the reaction clock.
      signalTime.current = performance.now()
      flushSync(() => setSignal(true))
      playSound('silence')
      playSound('duelSignal')
    }, duel.waitMs)
    const pulse = window.setInterval(ambience, SETSUNA.heartbeatIntervalMs)
    ambience()
    return () => {
      window.clearInterval(pulse)
      window.clearTimeout(reveal)
    }
  }, [duel, waiting])

  function settle(outcome: RoundResult['outcome'], reactionMs: number | null = null) {
    if (settled.current) return
    settled.current = true
    setResult({ outcome, reactionMs })
    setFinishPlaying(!reducedEffects)
    if (strongEnemy) {
      setStrongRecord(saveStrongEnemy(difficulty, { mode: rematch ? 'rematch' : 'encounter', reactionMs }))
    } else if (outcome === 'win') {
      setBest(saveSetsunaBest(reactionMs, defeated + 1, difficulty))
    }
    onSound?.('silence')
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
    const { stepMs, slashMs, hitStopMs, silenceMs } = SETSUNA.finish
    const silenceAt = stepMs + slashMs + hitStopMs
    const draw = window.setTimeout(() => playSound('duelDraw'), stepMs)
    const silence = window.setTimeout(() => playSound('silence'), silenceAt)
    const fall = window.setTimeout(() => playSound('duelFall'), silenceAt + silenceMs)
    let completed = false
    const finish = window.setTimeout(() => {
      completed = true
      setFinishPlaying(false)
      playSound('duelSheathe')
    }, setsunaFinishMs)
    return () => {
      window.clearTimeout(draw)
      window.clearTimeout(silence)
      window.clearTimeout(fall)
      window.clearTimeout(finish)
      if (!completed) playSound('silence')
    }
  }, [playing])

  function resetInput() {
    roundStart.current = performance.now()
    signalTime.current = null
    answerBuffer.current = ''
    settled.current = false
    setSignal(false)
    setAnswer('')
    setFinishPlaying(false)
    setResult(null)
  }

  const nextDuel = useEffectEvent(() => {
    const nextDefeated = strongEnemy ? defeated : defeated + 1
    const encounter = !strongEnemy && rollsStrongEnemy(nextDefeated, missedRolls.current)
    if (encounter) {
      missedRolls.current = 0
      setStrongRecord(saveStrongEnemy(difficulty))
    } else if (!strongEnemy && nextDefeated >= setsunaStrongEnemy.afterWins) {
      missedRolls.current++
    }
    resetInput()
    setDefeated(nextDefeated)
    setStrongEnemy(encounter)
    setReady(encounter)
    // Encounter and rematch use the same question difficulty and reaction limit.
    setDuel(createDuel(difficulty, encounter ? setsunaStrongEnemy.afterWins : nextDefeated))
  })
  useEffect(() => {
    if (!won || playing || paused || rematch) return
    const timer = window.setTimeout(() => flushSync(nextDuel), SETSUNA.betweenRoundsMs)
    return () => window.clearTimeout(timer)
  }, [won, playing, paused, rematch])

  function handleKey(key: string, eventTime = performance.now()) {
    if (ready || settled.current || eventTime < roundStart.current) return
    const elapsed = signalTime.current === null ? -1 : eventTime - signalTime.current
    if (key === 'C' || key === 'Backspace') {
      answerBuffer.current = key === 'C' ? '' : answerBuffer.current.slice(0, -1)
      setAnswer(answerBuffer.current)
      return
    }
    const digit = /^\d$/.test(key)
    if (elapsed < 0) {
      if (!(autoConfirm ? digit : key === 'Enter')) return
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
    if (digit && answerBuffer.current.length < SETSUNA.question.maxInputLength) {
      answerBuffer.current += key
      setAnswer(answerBuffer.current)
    }
    if (key === 'Enter' || (autoConfirm && digit && matchesAnswerDigitCount(answerBuffer.current, String(duel.answer)))) {
      if (!answerBuffer.current) return
      const outcome = judgeDuel(Number(answerBuffer.current), duel.answer, elapsed, cpuLimit)
      settle(outcome === 'win' ? 'win' : 'wrong', outcome === 'win' ? elapsed : null)
    }
  }

  const handleKeyboard = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape' && !event.repeat && (playing || (won && !rematch))) {
      event.preventDefault()
      if (playing) setFinishPlaying(false)
      else if (won) setPaused(!paused)
      return
    }
    const key = gameKey(event)
    if (ready || !key || !keys.includes(key)) return
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
        <button type="button" onClick={onBack}>モード選択</button>
        <h1>刹那</h1>
        <span>{rematch ? '個別再戦' : strongEnemy ? '強敵戦' : `第${defeated + 1}戦`}</span>
      </header>
      <SetsunaArena key={`${defeated}:${strongEnemy}`} strongEnemy={strongEnemy} waiting={waiting} winner={result ? (won ? 'player' : 'opponent') : null} playing={playing} />
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
          ) : ready ? (
            <strong className="setsuna-enemy-name">{setsunaStrongEnemy.label}</strong>
          ) : (
            <strong className="setsuna-equation">
              {signal ? <><span className="setsuna-signal">！</span><span>{duel.expression}</span></>
                : earlyCount ? `お手つき ${earlyCount} / ${SETSUNA.maxFalseStarts}` : '合図を待て'}
            </strong>
          )}
        </div>
        {((!ready && !result) || answer) && (
          <span className="game-answer" aria-label="入力した答え">{answer}</span>
        )}
      </div>
      <div className="setsuna-controls">
        {ready ? (
          <div className="setsuna-actions">
            <button type="button" className="setsuna-start-enemy" onClick={() => {
              roundStart.current = performance.now()
              setReady(false)
            }}>強敵戦を開始</button>
          </div>
        ) : result ? (
          <div className="setsuna-actions">
            {!rematch && <p>{won && !strongEnemy ? defeated + 1 : defeated}人抜き</p>}
            {won && !rematch ? (
              <button type="button" onClick={() => setPaused(!paused)}>{paused ? '再開' : '一時停止'}</button>
            ) : (
              <>
                {rematch
                  ? <SetsunaDuelRecord record={strongRecord.rematch} />
                  : <SetsunaRecords best={best} rank={setsunaRank(difficulty, best, strongRecord)} />}
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
            <p className="setsuna-key-hint">{autoConfirm ? '数字キーで入力・桁数が合うと確定' : '数字キーで入力・Enterで確定'}</p>
          </>
        )}
      </div>
    </main>
  )
}

export function SetsunaDuelRecord({ record }: { record: ReturnType<typeof readStrongEnemy>['rematch'] }) {
  return (
    <p className="setsuna-duel-record">
      {record.wins}勝 {record.losses}敗 ・ 最速 {record.fastestMs === null ? '—' : formatReaction(record.fastestMs)}
    </p>
  )
}

export function SetsunaRecords({ best, rank }: { best: ReturnType<typeof saveSetsunaBest>; rank: string }) {
  return (
    <dl className="setsuna-records">
      <div><dt>段位</dt><dd>{rank}</dd></div>
      <div><dt>最速反応時間</dt><dd>{best.fastestMs === null ? '—' : formatReaction(best.fastestMs)}</dd></div>
      <div><dt>最高到達人数</dt><dd>{best.defeated}人</dd></div>
    </dl>
  )
}
