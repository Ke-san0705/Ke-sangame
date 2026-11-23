import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import { createDuel, formatReaction, judgeDuel, reactionLimits, saveSetsunaBest } from '../lib/setsuna'
import type { SoundCue } from '../lib/soundEffects'
import { GameKeypad, gameKey, keypadRows } from './GameKeypad'
import './SetsunaScreen.css'

const enemies = [
  { sprite: 'goblin', mirrored: true },
  { sprite: 'wolf', mirrored: true },
  { sprite: 'skeleton', mirrored: true },
  { sprite: 'death-knight', mirrored: false },
  { sprite: 'demon-king', mirrored: false },
]
const digits = keypadRows.filter((key) => /^\d$/.test(key)).concat('0')
const sprite = (name: string) => `${import.meta.env.BASE_URL}monsters/${name}.png`
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
  const [result, setResult] = useState<RoundResult | null>(null)
  const [best, setBest] = useState<ReturnType<typeof saveSetsunaBest> | null>(null)
  const signalTime = useRef<number | null>(null)
  const earlyInputs = useRef(0)
  const settled = useRef(false)

  const heartbeat = useEffectEvent(() => onSound?.('heartbeat'))
  const waiting = !signal && result === null
  useEffect(() => {
    if (!waiting) return
    heartbeat()
    const pulse = window.setInterval(() => heartbeat(), 720)
    const reveal = window.setTimeout(() => setSignal(true), duel.waitMs)
    return () => {
      window.clearInterval(pulse)
      window.clearTimeout(reveal)
    }
  }, [duel, waiting])

  useLayoutEffect(() => {
    signalTime.current = signal ? performance.now() : null
  }, [signal])

  function handleAnswer(key: string, eventTime = performance.now()) {
    if (settled.current) return
    const elapsed = signalTime.current === null ? -1 : eventTime - signalTime.current
    const outcome = judgeDuel(Number(key), duel.answer, elapsed, enemy, earlyInputs.current)
    if (outcome === 'early') {
      earlyInputs.current += 1
      setEarlyCount(earlyInputs.current)
      return
    }

    settled.current = true
    const reactionMs = outcome === 'win' || outcome === 'slow' ? elapsed : null
    setResult({ outcome, reactionMs })
    setBest(saveSetsunaBest(reactionMs, outcome === 'win' ? enemy + 1 : enemy))
  }

  const handleKeyboard = useEffectEvent((event: KeyboardEvent) => {
    const key = gameKey(event)
    if (!key || !digits.includes(key)) return
    event.preventDefault()
    if (!event.repeat) handleAnswer(key, event.isTrusted ? event.timeStamp : undefined)
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => handleKeyboard(event)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function nextDuel() {
    settled.current = false
    setEnemy(enemy + 1)
    setDuel(createDuel())
    setSignal(false)
    setResult(null)
  }

  const won = result?.outcome === 'win'
  const cleared = won && enemy + 1 === reactionLimits.length
  const finished = result && (!won || cleared)

  return (
    <main className="setsuna-screen" data-outcome={result ? (won ? 'win' : 'loss') : undefined}>
      <header className="setsuna-header">
        <button type="button" onClick={onBack}>モード選択</button>
        <h1>刹那</h1>
        <span>{enemy + 1} / {reactionLimits.length}</span>
      </header>
      <div className="setsuna-arena">
        <img src={sprite('hero')} alt="主人公" />
        <div className="setsuna-message" role="status">
          {result ? (
            <>
              <strong>{cleared ? 'クリア' : result.outcome === 'win' ? '勝利' : '敗北'}</strong>
              {result.reactionMs !== null && (
                <span className="setsuna-reaction">{formatReaction(result.reactionMs)}</span>
              )}
              {result.outcome !== 'win' && <span>{lossLabels[result.outcome]}</span>}
            </>
          ) : signal ? (
            <><strong>！</strong><span>{duel.expression}</span></>
          ) : (
            <span>{earlyCount ? 'お手つき 1 / 2' : '合図を待て'}</span>
          )}
        </div>
        <img
          className={enemies[enemy].mirrored ? 'setsuna-mirrored' : undefined}
          src={sprite(enemies[enemy].sprite)}
          alt={`対戦相手 ${enemy + 1}`}
        />
      </div>
      {result ? (
        <div className="setsuna-actions">
          {finished ? (
            <>
              <p>{won ? enemy + 1 : enemy}人抜き</p>
              {best && <SetsunaRecords best={best} />}
              <button type="button" onClick={onReplay}>もう一度</button>
            </>
          ) : (
            <button type="button" onClick={nextDuel}>次の相手</button>
          )}
        </div>
      ) : (
        <GameKeypad keys={digits} onKey={handleAnswer} />
      )}
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
