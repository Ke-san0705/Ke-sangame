import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { createQuestionGenerator, isCorrectAnswer } from '../lib/question-generator'
import type { Level, Question, QuestionMode } from '../lib/question-generator'
import { calculateScore } from '../lib/score'
import type { SoundCue } from '../lib/soundEffects'
import './GameScreen.css'

const START_COUNTDOWN_SECONDS = 3
const SURVIVAL_INITIAL_SECONDS = 20

function survivalBonusMs(correctCount: number) {
  if (correctCount >= 60) return 0
  if (correctCount >= 30) return 1_000
  return 2_000
}

const PASS_PENALTY_MS = 3_000
const PASS_REVEAL_MS = 1_000
const KEYPAD_ROWS = ['7', '8', '9', 'C', '4', '5', '6', 'pass', '1', '2', '3', 'Enter']

type ReviewQuestion = Pick<Question, 'expression' | 'answer'>

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
  onSound?: (cue: SoundCue) => void
  onFinish: (result: GameResult) => void
}

export function GameScreen({ level, mode, duration, onSound, onFinish }: GameScreenProps) {
  const survival = duration === 'survival'
  const initialTimeMs = (duration === 'survival' ? SURVIVAL_INITIAL_SECONDS : duration) * 1000
  const [{ generateQuestion, firstQuestion }] = useState(() => {
    const generateQuestion = createQuestionGenerator()
    return { generateQuestion, firstQuestion: generateQuestion(level, mode) }
  })
  const [question, setQuestion] = useState(firstQuestion)
  const [answer, setAnswer] = useState('')
  const [showPassAnswer, setShowPassAnswer] = useState(false)
  const passTimeout = useRef<number | undefined>(undefined)
  const reviewQuestions = useRef<ReviewQuestion[]>([])
  const currentQuestionRecorded = useRef(false)
  const [counts, setCounts] = useState({ correctCount: 0, incorrectCount: 0, passCount: 0 })
  const latestCounts = useRef(counts)
  const combo = useRef({ streak: 0, max: 0 })
  const { correctCount, incorrectCount, passCount } = counts
  const [countdown, setCountdown] = useState(START_COUNTDOWN_SECONDS)
  const playing = countdown === 0
  const [remaining, setRemaining] = useState(initialTimeMs)
  const deadline = useRef(0)
  const questionStartedAt = useRef(0)
  const totalCorrectAnswerMs = useRef(0)
  const lastCountdownSecond = useRef(0)
  const finished = useRef(false)

  const acceptsDecimal = level >= 2
  const acceptsNegative = level >= 3

  function recordAnswer(kind: keyof typeof counts) {
    const streak = kind === 'correctCount' ? combo.current.streak + 1 : 0
    combo.current = { streak, max: Math.max(combo.current.max, streak) }
    const current = latestCounts.current
    const next = { ...current, [kind]: current[kind] + 1 }
    latestCounts.current = next
    setCounts(next)
  }

  function recordReviewQuestion() {
    if (currentQuestionRecorded.current) return
    currentQuestionRecorded.current = true
    reviewQuestions.current.push({ expression: question.expression, answer: question.answer })
  }

  function finish() {
    if (finished.current) return
    finished.current = true
    const finalCounts = latestCounts.current
    const { correctCount } = finalCounts
    onSound?.('timeUp')
    onFinish({
      correctCount,
      maxCombo: combo.current.max,
      ...calculateScore({ ...finalCounts, level, maxCombo: combo.current.max }),
      reviewQuestions: reviewQuestions.current,
      averageAnswerSeconds: correctCount === 0 ? 0 : totalCorrectAnswerMs.current / correctCount / 1000,
    })
  }

  function updateRemaining(timeLeft: number) {
    setRemaining(timeLeft)
    const seconds = Math.ceil(timeLeft / 1000)
    if (seconds >= 1 && seconds <= 3 && seconds !== lastCountdownSecond.current) {
      onSound?.('countdown')
    }
    lastCountdownSecond.current = seconds
  }

  function nextQuestion(now: number) {
    questionStartedAt.current = now
    currentQuestionRecorded.current = false
    setQuestion(generateQuestion(level, mode))
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
        recordReviewQuestion()
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
          nextQuestion(now)
        } else {
          onSound?.('incorrect')
          recordAnswer('incorrectCount')
          recordReviewQuestion()
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
    let count = START_COUNTDOWN_SECONDS
    const interval = window.setInterval(() => {
      count -= 1
      setCountdown(count)
      if (count === 0) window.clearInterval(interval)
    }, 1_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!playing) return
    const now = performance.now()
    questionStartedAt.current = now
    lastCountdownSecond.current = 0
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

  const percentage = Math.min(100, remaining / initialTimeMs * 100)
  const keypad = [...KEYPAD_ROWS, '0']
  if (acceptsNegative) keypad.push('−')
  if (acceptsDecimal) keypad.push('.')

  return (
    <main className="game-screen" aria-label="ゲーム">
      <div className="game-timer-bar" aria-hidden="true">
        <div
          className="game-timer-fill"
          data-time={percentage <= 20 ? 'low' : percentage <= 50 ? 'medium' : 'high'}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <header className="game-status">
        <div className="game-countdown" role="timer" aria-label="残り時間">
          {Math.ceil(remaining / 1000)}
        </div>
        <span className="game-correct">正解 {correctCount}</span>
        <span className="game-misses">ミス {incorrectCount + passCount}</span>
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
