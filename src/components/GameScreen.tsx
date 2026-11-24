import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from 'react'
import { createQuestionGenerator, isCorrectAnswer } from '../lib/question-generator'
import type { Level, Question, QuestionMode } from '../lib/question-generator'
import { calculateCharge } from '../lib/charge'
import type { ChargeResult } from '../lib/charge'
import type { ReleaseResult } from '../lib/release'
import { calculateScore } from '../lib/score'
import { BATTLE_FEEDBACK, CHARGE_HUD } from '../lib/battleUi'
import type { SoundCue } from '../lib/soundEffects'
import { ChargeArena, preloadChargeSprites } from './ChargeArena'
import { ReleaseSequence } from './ReleaseSequence'
import { GameKeypad, gameKey, keypadRows } from './GameKeypad'

const FINAL_INPUT_DRAIN_MS = 50
const START_COUNTDOWN_SECONDS = 3
const SURVIVAL_INITIAL_SECONDS = 20
const TIMER_WARNING_SECONDS = 10
const TIMER_SOUND_SECONDS = 5
const TIME_BONUS_POP_MS = 800
const CRITICAL_NOTICE_MS = 650
const OVERCHARGE_MISS_MS = 3_000
const OVERCHARGE_TIME_MS = 10_000

function survivalBonusMs(correctCount: number) {
  if (correctCount >= 60) return 0
  if (correctCount >= 30) return 1_000
  return 2_000
}

const CRITICAL_TIME_MS = { 1: 3_000, 2: 4_000, 3: 5_000, 4: 7_000, 5: 10_000 }
const PASS_PENALTY_MS = 3_000
const PASS_REVEAL_MS = 1_000

type ReviewQuestion = Pick<Question, 'expression' | 'answer'> & {
  outcome: 'miss' | 'pass' | 'timeout'
  wrongAnswers: string[]
}

export type GameResult = ReturnType<typeof calculateScore> & {
  correctCount: number
  charge?: ChargeResult
  release?: ReleaseResult
  maxCombo: number
  averageAnswerSeconds: number
  paceCurve?: number[]
  reviewQuestions: ReviewQuestion[]
}

type GameScreenProps = {
  level: Level
  mode: QuestionMode
  duration: number | 'survival'
  skipCountdown?: boolean
  showMonsterBattle?: boolean
  lowPower?: boolean
  bestCurve?: number[]
  onSound?: (cue: SoundCue, combo?: number) => void
  onFinish: (result: GameResult) => void
}

export function GameScreen({
  level, mode, duration, skipCountdown = false, showMonsterBattle = false, lowPower = false, bestCurve, onSound, onFinish,
}: GameScreenProps) {
  const survival = duration === 'survival'
  const battleSurvival = survival && showMonsterBattle
  const initialTimeMs = (survival ? SURVIVAL_INITIAL_SECONDS : duration) * 1000
  const [{ generateQuestion, firstQuestion }] = useState(() => {
    const generateQuestion = createQuestionGenerator()
    return { generateQuestion, firstQuestion: generateQuestion(level, mode) }
  })
  const [question, setQuestion] = useState(firstQuestion)
  const [answer, setAnswer] = useState('')
  const latestAnswer = useRef('')
  const [showPassAnswer, setShowPassAnswer] = useState(false)
  const passTimeout = useRef<number | undefined>(undefined)
  const reviewQuestions = useRef<ReviewQuestion[]>([])
  const currentQuestion = useRef(firstQuestion)
  const wrongAnswers = useRef<string[]>([])
  const currentQuestionResolved = useRef(false)
  const [counts, setCounts] = useState({ correctCount: 0, incorrectCount: 0, passCount: 0, combo: 0, maxCombo: 0, criticalCount: 0 })
  const latestCounts = useRef(counts)
  const [criticalAnswer, setCriticalAnswer] = useState<number>()
  const criticalTimeout = useRef<number | undefined>(undefined)
  const [comboNotice, setComboNotice] = useState<number>()
  const comboTimeout = useRef<number | undefined>(undefined)
  const { correctCount, incorrectCount, passCount } = counts
  const [countdown, setCountdown] = useState(skipCountdown ? 0 : START_COUNTDOWN_SECONDS)
  const [pendingRelease, setPendingRelease] = useState<{ result: GameResult; overcharged: boolean }>()
  const playing = countdown === 0 && pendingRelease === undefined
  const [remaining, setRemaining] = useState(initialTimeMs)
  const [missOvercharge, setMissOvercharge] = useState(false)
  const missOverchargeTimeout = useRef<number | undefined>(undefined)
  const wasOvercharged = useRef(false)
  const overchargeActive = showMonsterBattle && remaining > 0
    && (missOvercharge || remaining <= OVERCHARGE_TIME_MS)
  const [timeBonus, setTimeBonus] = useState<{ seconds: number; answerCount: number }>()
  const timeBonusTimeout = useRef<number | undefined>(undefined)
  const deadline = useRef(0)
  const gameStartedAt = useRef(0)
  const [elapsedSecond, setElapsedSecond] = useState(0)
  const correctPerSecond = useRef<number[] | undefined>(undefined)
  const questionStartedAt = useRef(0)
  const totalCorrectAnswerMs = useRef(0)
  const lastCountdownSecond = useRef(0)
  const finished = useRef(false)

  const acceptsDecimal = level >= 2
  const acceptsNegative = level >= 3

  function updateAnswer(value: string) {
    latestAnswer.current = value
    setAnswer(value)
  }

  function recordAnswer(kind: 'correctCount' | 'incorrectCount' | 'passCount', critical = false) {
    const current = latestCounts.current
    const combo = kind === 'correctCount' ? current.combo + 1 : 0
    const next = {
      ...current,
      [kind]: current[kind] + 1,
      combo,
      maxCombo: Math.max(current.maxCombo, combo),
      criticalCount: current.criticalCount + Number(critical),
    }
    latestCounts.current = next
    setCounts(next)
    if (showMonsterBattle) {
      window.clearTimeout(comboTimeout.current)
      setComboNotice(combo >= BATTLE_FEEDBACK.comboMinimum ? combo : undefined)
      if (combo >= BATTLE_FEEDBACK.comboMinimum) {
        comboTimeout.current = window.setTimeout(() => setComboNotice(undefined), BATTLE_FEEDBACK.comboDurationMs)
      }
    }
  }

  function recordReviewQuestion(outcome: ReviewQuestion['outcome']) {
    const { expression, answer } = currentQuestion.current
    reviewQuestions.current.push({ expression, answer, outcome, wrongAnswers: wrongAnswers.current })
  }

  function finish() {
    if (finished.current) return
    finished.current = true
    if (!currentQuestionResolved.current) {
      recordReviewQuestion(wrongAnswers.current.length > 0 ? 'miss' : 'timeout')
    }
    const finalCounts = latestCounts.current
    const { correctCount, maxCombo } = finalCounts
    let cumulativeCorrect = 0
    const paceCurve = correctPerSecond.current?.map((count) => {
      cumulativeCorrect += count
      return cumulativeCorrect
    })
    onSound?.('timeUp')
    const result: GameResult = {
      correctCount,
      maxCombo,
      ...(showMonsterBattle && {
        charge: { power: calculateCharge(finalCounts), criticalCount: finalCounts.criticalCount },
      }),
      ...calculateScore({ ...finalCounts, level }),
      paceCurve,
      reviewQuestions: reviewQuestions.current,
      averageAnswerSeconds: correctCount === 0 ? 0 : totalCorrectAnswerMs.current / correctCount / 1000,
    }
    if (result.charge) setPendingRelease({ result, overcharged: wasOvercharged.current })
    else onFinish(result)
  }

  function updateRemaining(timeLeft: number) {
    if (showMonsterBattle && timeLeft <= OVERCHARGE_TIME_MS) wasOvercharged.current = true
    setRemaining(timeLeft)
    const seconds = Math.ceil(timeLeft / 1000)
    if (seconds >= 1 && seconds <= TIMER_SOUND_SECONDS && seconds < lastCountdownSecond.current) {
      onSound?.('countdown')
    }
    lastCountdownSecond.current = seconds
  }

  function nextQuestion(now: number) {
    questionStartedAt.current = now
    currentQuestionResolved.current = false
    wrongAnswers.current = []
    const next = generateQuestion(level, mode)
    currentQuestion.current = next
    setQuestion(next)
  }

  function handleKey(key: string, eventTime?: number) {
    if (finished.current || currentQuestionResolved.current || passTimeout.current !== undefined) return
    const now = performance.now()
    const answerTime = eventTime ?? now
    if (answerTime < questionStartedAt.current || answerTime > deadline.current) return
    if (key === 'pass' && now >= deadline.current) return
    const answer = latestAnswer.current

    switch (key) {
      case 'C':
        updateAnswer('')
        return
      case 'pass': {
        recordAnswer('passCount')
        currentQuestionResolved.current = true
        recordReviewQuestion('pass')
        if (!survival) deadline.current -= PASS_PENALTY_MS
        updateRemaining(Math.max(0, deadline.current - now))
        updateAnswer('')
        setShowPassAnswer(true)
        passTimeout.current = window.setTimeout(() => {
          passTimeout.current = undefined
          const nextQuestionTime = performance.now()
          if (nextQuestionTime >= deadline.current) {
            finish()
            return
          }
          setShowPassAnswer(false)
          nextQuestion(nextQuestionTime)
        }, PASS_REVEAL_MS)
        return
      }
      case 'Enter':
        if (answer === '') return
        updateAnswer('')
        if (isCorrectAnswer(currentQuestion.current, answer)) {
          const elapsedMs = Math.max(0, answerTime - questionStartedAt.current)
          totalCorrectAnswerMs.current += elapsedMs
          if (correctPerSecond.current) {
            // 配列の各要素は、その経過秒に到達した時点の累積正解数になる。
            const second = Math.ceil(Math.max(0, answerTime - gameStartedAt.current) / 1000)
            correctPerSecond.current[second] += 1
          }
          const critical = showMonsterBattle && elapsedMs <= CRITICAL_TIME_MS[level]
          recordAnswer('correctCount', critical)
          if (showMonsterBattle) {
            window.clearTimeout(criticalTimeout.current)
            setCriticalAnswer(critical ? latestCounts.current.correctCount : undefined)
            if (critical) {
              criticalTimeout.current = window.setTimeout(() => setCriticalAnswer(undefined), CRITICAL_NOTICE_MS)
            }
          }
          onSound?.('correct', latestCounts.current.combo)
          if (survival) {
            // A bonus can bring the timer back above the threshold before the next tick.
            if (battleSurvival && deadline.current - answerTime <= OVERCHARGE_TIME_MS) {
              wasOvercharged.current = true
            }
            const answerCount = latestCounts.current.correctCount
            const bonusMs = survivalBonusMs(answerCount)
            deadline.current += bonusMs
            updateRemaining(Math.max(0, deadline.current - now))
            if (battleSurvival && bonusMs > 0) {
              window.clearTimeout(timeBonusTimeout.current)
              setTimeBonus({ seconds: bonusMs / 1000, answerCount })
              timeBonusTimeout.current = window.setTimeout(() => setTimeBonus(undefined), TIME_BONUS_POP_MS)
            }
          }
          if (wrongAnswers.current.length > 0) recordReviewQuestion('miss')
          if (now < deadline.current) {
            nextQuestion(now)
          } else {
            currentQuestionResolved.current = true
          }
        } else {
          onSound?.('incorrect')
          recordAnswer('incorrectCount')
          wrongAnswers.current.push(answer)
          if (showMonsterBattle) {
            wasOvercharged.current = true
            setMissOvercharge(true)
            window.clearTimeout(missOverchargeTimeout.current)
            missOverchargeTimeout.current = window.setTimeout(() => setMissOvercharge(false), OVERCHARGE_MISS_MS)
            recordReviewQuestion('miss')
            if (now < deadline.current) nextQuestion(now)
            else currentQuestionResolved.current = true
          }
        }
        return
      default:
        if (/^\d$/.test(key)
          || (key === '.' && acceptsDecimal && !answer.includes('.'))
          || (key === '-' && acceptsNegative && answer === '')) {
          updateAnswer(answer + key)
        }
    }
  }

  const handleKeyboard = useEffectEvent((event: KeyboardEvent) => {
    const key = gameKey(event)
    if (!key) return
    event.preventDefault()
    if (event.repeat && (key === 'pass' || key === 'Enter')) return
    handleKey(key, event.isTrusted ? event.timeStamp : undefined)
  })

  const updateTimer = useEffectEvent(() => {
    if (finished.current) return false
    const now = performance.now()
    const timeLeft = Math.max(0, deadline.current - now)
    if (bestCurve) {
      const seconds = Math.floor((now - gameStartedAt.current) / 1000)
      setElapsedSecond(Math.min(bestCurve.length - 1, seconds))
    }
    updateRemaining(timeLeft)
    return timeLeft === 0 && (survival || passTimeout.current === undefined)
  })

  const finishOnTimeUp = useEffectEvent(() => {
    if (performance.now() >= deadline.current) finish()
  })

  useEffect(() => {
    if (skipCountdown) return
    let count = START_COUNTDOWN_SECONDS
    const interval = window.setInterval(() => {
      count -= 1
      setCountdown(count)
      if (count === 0) window.clearInterval(interval)
    }, 1_000)
    return () => window.clearInterval(interval)
  }, [skipCountdown])

  useEffect(() => {
    if (!playing) return
    const now = performance.now()
    correctPerSecond.current = duration === 'survival' ? undefined : Array<number>(duration + 1).fill(0)
    gameStartedAt.current = now
    questionStartedAt.current = now
    lastCountdownSecond.current = Math.ceil(initialTimeMs / 1000) + 1
    deadline.current = now + initialTimeMs
    let finishTimeout: number | undefined
    const tick = () => {
      if (!updateTimer() || finishTimeout !== undefined) return
      // Give queued input time to reach the handlers. The deadline still gates event timestamps.
      finishTimeout = window.setTimeout(() => {
        finishTimeout = undefined
        finishOnTimeUp()
      }, FINAL_INPUT_DRAIN_MS)
    }
    const interval = window.setInterval(tick, 50)
    const timeout = window.setTimeout(tick, initialTimeMs)
    const onKeyDown = (event: KeyboardEvent) => handleKeyboard(event)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(timeout)
      window.clearTimeout(finishTimeout)
      window.clearTimeout(passTimeout.current)
      window.clearTimeout(timeBonusTimeout.current)
      window.clearTimeout(criticalTimeout.current)
      window.clearTimeout(comboTimeout.current)
      window.clearTimeout(missOverchargeTimeout.current)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [duration, initialTimeMs, playing])

  useEffect(() => {
    if (showMonsterBattle) preloadChargeSprites()
  }, [showMonsterBattle])

  if (pendingRelease?.result.charge) {
    return (
      <ReleaseSequence
        power={pendingRelease.result.charge.power}
        correctCount={pendingRelease.result.correctCount}
        overcharged={pendingRelease.overcharged}
        onComplete={(release) => onFinish({ ...pendingRelease.result, release })}
      />
    )
  }

  if (!playing) {
    return (
      <main className="game-screen game-start-countdown" aria-label="ゲーム">
        <div role="status" aria-label="開始までの秒数">{countdown}</div>
      </main>
    )
  }

  const paceDifference = bestCurve ? correctCount - bestCurve[elapsedSecond] : undefined
  const remainingSeconds = Math.ceil(remaining / 1000)
  const { score } = calculateScore({ ...counts, level })
  const percentage = Math.min(100, remaining / initialTimeMs * 100)
  const keypad = [...keypadRows, '0']
  if (acceptsNegative) keypad.push('−')
  if (acceptsDecimal) keypad.push('.')

  return (
    <main className={showMonsterBattle ? 'game-screen game-screen-charge battle-screen' : 'game-screen'} aria-label="ゲーム">
      {showMonsterBattle ? (
        <header className="battle-hud">
          <div className="battle-stat game-time">
            <span>残り時間</span>
            <strong
              role="timer"
              aria-label="残り時間"
              data-time={remainingSeconds <= TIMER_WARNING_SECONDS ? 'low' : 'normal'}
            >
              {remainingSeconds}
            </strong>
            <span role="status" className="game-time-bonus">
              {timeBonus && <span key={timeBonus.answerCount}>＋{timeBonus.seconds}秒</span>}
            </span>
          </div>
          <div className="battle-stat battle-health">
            <span>HP</span>
            <meter aria-label="HP" value={CHARGE_HUD.health} />
          </div>
          <div className="battle-stat">
            <span>討伐数</span>
            <strong>{CHARGE_HUD.defeated}</strong>
          </div>
        </header>
      ) : (
        <header className="game-hud">
          <div className="game-timer-bar" aria-hidden="true">
            <div
              className="game-timer-fill"
              data-time={remainingSeconds <= TIMER_WARNING_SECONDS ? 'low' : 'normal'}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="game-status">
            <div className="game-time">
              <strong className="game-stat-value" role="timer" aria-label="残り時間">
                {remainingSeconds}
              </strong>
            </div>
            <div className="game-score" role="group" aria-label="暫定スコア">
              <span className="game-stat-label" aria-hidden="true">スコア（暫定）</span>
              <strong className="game-stat-value">{score.toLocaleString('ja-JP')}</strong>
            </div>
            <span className="game-correct">正解 {correctCount}</span>
            <span
              key={incorrectCount}
              className={incorrectCount > 0 ? 'game-misses game-feedback-pop' : 'game-misses'}
            >
              ミス {incorrectCount + passCount}
            </span>
            {paceDifference !== undefined && (
              <span className="game-pace">
                {`ベスト比 ${paceDifference > 0 ? '+' : paceDifference < 0 ? '−' : ''}${Math.abs(paceDifference)}問`}
              </span>
            )}
          </div>
        </header>
      )}
      {showMonsterBattle && (
        <ChargeArena correctCount={correctCount} overcharged={overchargeActive} battle={{
          lowPower,
          foreground: (
            <>
              {criticalAnswer !== undefined && <div key={criticalAnswer} className="charge-flash" aria-hidden="true" />}
              <div className="battle-feedback" role="status">
                {overchargeActive && <strong className="game-overcharge-warning">危険！過充電</strong>}
                {comboNotice !== undefined && <strong key={correctCount} className="battle-combo">{comboNotice} COMBO</strong>}
                {criticalAnswer !== undefined && <strong key={`critical-${criticalAnswer}`} className="charge-critical-status">CRITICAL CHARGE!</strong>}
              </div>
            </>
          ),
        }} />
      )}
      <GameProblem
        expression={question.expression}
        answer={(showPassAnswer ? question.answer : answer).replace('-', '−')}
        showPassAnswer={showPassAnswer}
      />
      <GameKeypad keys={keypad} disabled={showPassAnswer} onKey={handleKey} />
      <div className="game-shortcuts">
        <span>Enter：決定</span>
        <span>Backspace：クリア</span>
        <button type="button" disabled={showPassAnswer} onClick={() => handleKey('pass')}>Tab：パス</button>
      </div>
    </main>
  )
}

function fitText(element: HTMLElement, availableWidth: number) {
  element.style.removeProperty('--game-text-scale')
  const width = () => element.getBoundingClientRect().width
  if (width() <= availableWidth) return

  // The layout stays readable and scrollable if even the minimum size is too wide.
  let min = 0
  let max = 1
  for (let step = 0; step < 8; step++) {
    const scale = (min + max) / 2
    element.style.setProperty('--game-text-scale', String(scale))
    if (width() <= availableWidth) min = scale
    else max = scale
  }
  element.style.setProperty('--game-text-scale', String(min))
}

function GameProblem({ expression, answer, showPassAnswer }: {
  expression: string
  answer: string
  showPassAnswer: boolean
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const lines = useRef<HTMLDivElement>(null)
  const expressionText = useRef<HTMLSpanElement>(null)
  const answerText = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const container = viewport.current
    const group = lines.current
    const equation = expressionText.current
    const input = answerText.current
    if (!container || !group || !equation || !input) return

    let lastWidth = 0
    const fit = () => {
      const width = container.clientWidth
      lastWidth = width
      if (getComputedStyle(group).display === 'flex') {
        equation.style.removeProperty('--game-text-scale')
        input.style.removeProperty('--game-text-scale')
        fitText(group, width)
      } else {
        group.style.removeProperty('--game-text-scale')
        fitText(equation, width)
        fitText(input, width)
      }
    }

    fit()
    const observer = new ResizeObserver(() => {
      if (container.clientWidth !== lastWidth) fit()
    })
    observer.observe(container)
    document.fonts?.addEventListener('loadingdone', fit)
    return () => {
      observer.disconnect()
      document.fonts?.removeEventListener('loadingdone', fit)
    }
  }, [expression, answer, showPassAnswer])

  return (
    <div className="game-problem">
      <div className="game-problem-viewport" ref={viewport}>
        <div className="game-problem-lines" ref={lines}>
          <div className="game-problem-line">
            <span className="game-expression" ref={expressionText}>{expression} =</span>
          </div>
          <div className="game-problem-line">
            <span
              className="game-answer"
              ref={answerText}
              role={showPassAnswer ? 'status' : undefined}
              aria-label={showPassAnswer ? undefined : '入力した答え'}
            >
              {showPassAnswer ? `正解：${answer}` : answer}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
