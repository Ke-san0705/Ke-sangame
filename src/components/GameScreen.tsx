import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { createQuestionGenerator, isCorrectAnswer } from '../lib/question-generator'
import type { Level, Question, QuestionMode } from '../lib/question-generator'
import { calculateScore } from '../lib/score'
import type { SoundCue } from '../lib/soundEffects'
import './GameScreen.css'

const START_COUNTDOWN_SECONDS = 3
const SURVIVAL_INITIAL_SECONDS = 20
const TIMER_WARNING_SECONDS = 10
const TIMER_SOUND_SECONDS = 5

function survivalBonusMs(correctCount: number) {
  if (correctCount >= 60) return 0
  if (correctCount >= 30) return 1_000
  return 2_000
}

const PASS_PENALTY_MS = 3_000
const PASS_REVEAL_MS = 1_000
const KEYPAD_ROWS = ['7', '8', '9', 'C', '4', '5', '6', 'pass', '1', '2', '3', 'Enter']

type ReviewQuestion = Pick<Question, 'expression' | 'answer'> & {
  outcome: 'miss' | 'pass' | 'timeout'
  wrongAnswers: string[]
}

export type GameResult = ReturnType<typeof calculateScore> & {
  correctCount: number
  maxCombo: number
  averageAnswerSeconds: number
  reviewQuestions: ReviewQuestion[]
}

type GameScreenProps = {
  level: Level
  mode: QuestionMode
  duration: number | 'survival'
  skipCountdown?: boolean
  onSound?: (cue: SoundCue) => void
  onFinish: (result: GameResult) => void
}

export function GameScreen({ level, mode, duration, skipCountdown = false, onSound, onFinish }: GameScreenProps) {
  const survival = duration === 'survival'
  const initialTimeMs = (survival ? SURVIVAL_INITIAL_SECONDS : duration) * 1000
  const [{ generateQuestion, firstQuestion }] = useState(() => {
    const generateQuestion = createQuestionGenerator()
    return { generateQuestion, firstQuestion: generateQuestion(level, mode) }
  })
  const [question, setQuestion] = useState(firstQuestion)
  const [answer, setAnswer] = useState('')
  const [showPassAnswer, setShowPassAnswer] = useState(false)
  const passTimeout = useRef<number | undefined>(undefined)
  const reviewQuestions = useRef<ReviewQuestion[]>([])
  const currentQuestion = useRef(firstQuestion)
  const wrongAnswers = useRef<string[]>([])
  const currentQuestionResolved = useRef(false)
  const [counts, setCounts] = useState({ correctCount: 0, incorrectCount: 0, passCount: 0, maxCombo: 0 })
  const latestCounts = useRef(counts)
  const streak = useRef(0)
  const { correctCount, incorrectCount, passCount } = counts
  const [countdown, setCountdown] = useState(skipCountdown ? 0 : START_COUNTDOWN_SECONDS)
  const playing = countdown === 0
  const [remaining, setRemaining] = useState(initialTimeMs)
  const deadline = useRef(0)
  const questionStartedAt = useRef(0)
  const totalCorrectAnswerMs = useRef(0)
  const lastCountdownSecond = useRef(0)
  const finished = useRef(false)

  const acceptsDecimal = level >= 2
  const acceptsNegative = level >= 3

  function recordAnswer(kind: 'correctCount' | 'incorrectCount' | 'passCount') {
    streak.current = kind === 'correctCount' ? streak.current + 1 : 0
    const current = latestCounts.current
    const next = {
      ...current,
      [kind]: current[kind] + 1,
      maxCombo: Math.max(current.maxCombo, streak.current),
    }
    latestCounts.current = next
    setCounts(next)
  }

  function recordReviewQuestion(outcome: ReviewQuestion['outcome']) {
    const { expression, answer } = currentQuestion.current
    reviewQuestions.current.push({ expression, answer, outcome, wrongAnswers: wrongAnswers.current })
  }

  function finish() {
    if (finished.current) return
    finished.current = true
    if (!currentQuestionResolved.current) recordReviewQuestion('timeout')
    const finalCounts = latestCounts.current
    const { correctCount, maxCombo } = finalCounts
    onSound?.('timeUp')
    onFinish({
      correctCount,
      maxCombo,
      ...calculateScore({ ...finalCounts, level }),
      reviewQuestions: reviewQuestions.current,
      averageAnswerSeconds: correctCount === 0 ? 0 : totalCorrectAnswerMs.current / correctCount / 1000,
    })
  }

  function updateRemaining(timeLeft: number) {
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

  function handleKey(key: string, submittedAt?: number) {
    if (finished.current || passTimeout.current !== undefined) return
    const now = performance.now()
    const answerTime = submittedAt ?? now
    if (key === 'Enter' ? answerTime > deadline.current : now >= deadline.current) return

    switch (key) {
      case 'C':
        setAnswer('')
        return
      case 'pass': {
        recordAnswer('passCount')
        currentQuestionResolved.current = true
        recordReviewQuestion('pass')
        if (!survival) deadline.current -= PASS_PENALTY_MS
        updateRemaining(Math.max(0, deadline.current - now))
        setAnswer('')
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
        setAnswer('')
        if (isCorrectAnswer(question, answer)) {
          onSound?.('correct')
          totalCorrectAnswerMs.current += Math.max(0, answerTime - questionStartedAt.current)
          recordAnswer('correctCount')
          if (survival) {
            deadline.current += survivalBonusMs(latestCounts.current.correctCount)
            updateRemaining(Math.max(0, deadline.current - now))
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
        }
        return
      default:
        if (/^\d$/.test(key)
          || (key === '.' && acceptsDecimal && !answer.includes('.'))
          || (key === '-' && acceptsNegative && answer === '')) {
          setAnswer(answer + key)
        }
    }
  }

  const handleKeyboard = useEffectEvent((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return
    const key = event.key === 'Backspace' ? 'C'
      : event.key === 'Tab' ? 'pass'
      : event.key
    if (!['C', 'pass', 'Enter', '.', '-'].includes(key) && !/^\d$/.test(key)) return
    event.preventDefault()
    if (event.repeat && (key === 'pass' || key === 'Enter')) return
    handleKey(key, key === 'Enter' && event.isTrusted ? event.timeStamp : undefined)
  })

  const updateTimer = useEffectEvent(() => {
    const timeLeft = Math.max(0, deadline.current - performance.now())
    if (finished.current) return false
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
    questionStartedAt.current = now
    lastCountdownSecond.current = Math.ceil(initialTimeMs / 1000) + 1
    deadline.current = now + initialTimeMs
    let finishTimeout: number | undefined
    const tick = () => {
      if (!updateTimer() || finishTimeout !== undefined) return
      // Let a pending Enter at the deadline run before taking the result snapshot.
      finishTimeout = window.setTimeout(() => {
        finishTimeout = undefined
        finishOnTimeUp()
      }, 0)
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
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [initialTimeMs, playing])

  if (!playing) {
    return (
      <main className="game-screen game-start-countdown" aria-label="ゲーム">
        <div role="status" aria-label="開始までの秒数">{countdown}</div>
      </main>
    )
  }

  const remainingSeconds = Math.ceil(remaining / 1000)
  const { score } = calculateScore({ ...counts, level })
  const percentage = Math.min(100, remaining / initialTimeMs * 100)
  const keypad = [...KEYPAD_ROWS, '0']
  if (acceptsNegative) keypad.push('−')
  if (acceptsDecimal) keypad.push('.')

  return (
    <main className="game-screen" aria-label="ゲーム">
      <header className="game-hud">
        <div className="game-timer-bar" aria-hidden="true">
          <div
            className="game-timer-fill"
            data-time={remainingSeconds <= TIMER_WARNING_SECONDS ? 'low' : 'normal'}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="game-status">
          <div className="game-countdown">
            <span className="game-stat-label" aria-hidden="true">残り時間（秒）</span>
            <strong className="game-stat-value" role="timer" aria-label="残り時間">
              {remainingSeconds}
            </strong>
          </div>
          <div className="game-score" role="group" aria-label="暫定スコア">
            <span className="game-stat-label" aria-hidden="true">スコア（暫定）</span>
            <strong className="game-stat-value">{score.toLocaleString('ja-JP')}</strong>
          </div>
          <span className="game-correct">正解 {correctCount}</span>
          <span className="game-misses">ミス {incorrectCount + passCount}</span>
        </div>
      </header>
      <div className="game-problem">
        <span>{question.expression} =</span>
        {showPassAnswer ? (
          <span className="game-answer" role="status">正解：{question.answer.replace('-', '−')}</span>
        ) : (
          <span className="game-answer" aria-label="入力した答え">{answer.replace('-', '−')}</span>
        )}
      </div>
      <div className="game-keypad" role="group" aria-label="テンキー">
        {keypad.map((key) => (
          <button
            key={key}
            type="button"
            disabled={showPassAnswer}
            className={`game-key game-key-${key === '.' ? 'decimal' : key === '−' ? 'minus' : key}`}
            onClick={(event) => handleKey(
              key === '−' ? '-' : key,
              key === 'Enter' && event.isTrusted ? event.timeStamp : undefined,
            )}
          >
            {key}
          </button>
        ))}
      </div>
      <div className="game-shortcuts">
        <span>Enter：決定</span>
        <span>Backspace：クリア</span>
        <button type="button" disabled={showPassAnswer} onClick={() => handleKey('pass')}>Tab：パス</button>
      </div>
    </main>
  )
}
