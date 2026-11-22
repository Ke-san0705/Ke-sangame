import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { createQuestionGenerator, isCorrectAnswer } from '../lib/question-generator'
import type { Level, QuestionMode } from '../lib/question-generator'
import { calculateScore } from '../lib/score'
import type { SoundCue } from '../lib/soundEffects'
import './GameScreen.css'

const PASS_PENALTY_MS = 3_000
const KEYPAD_ROWS = ['7', '8', '9', 'C', '4', '5', '6', 'pass', '1', '2', '3', 'Enter']

export type GameResult = {
  correctCount: number
  missCount: number
  accuracy: number
  score: number
  averageAnswerSeconds: number
}

type GameScreenProps = {
  level: Level
  mode: QuestionMode
  duration: number
  onSound?: (cue: SoundCue) => void
  onFinish: (result: GameResult) => void
}

export function GameScreen({ level, mode, duration, onSound, onFinish }: GameScreenProps) {
  const [{ generateQuestion, firstQuestion }] = useState(() => {
    const generateQuestion = createQuestionGenerator()
    return { generateQuestion, firstQuestion: generateQuestion(level, mode) }
  })
  const [question, setQuestion] = useState(firstQuestion)
  const [answer, setAnswer] = useState('')
  const [correctCount, setCorrectCount] = useState(0)
  const [incorrectCount, setIncorrectCount] = useState(0)
  const [passCount, setPassCount] = useState(0)
  const [remaining, setRemaining] = useState(duration * 1000)
  const deadline = useRef(0)
  const questionStartedAt = useRef(0)
  const totalCorrectAnswerMs = useRef(0)
  const lastCountdownSecond = useRef(0)
  const finished = useRef(false)

  const acceptsDecimal = level >= 2
  const acceptsNegative = level >= 3

  function finish(finalPassCount = passCount) {
    if (finished.current) return
    finished.current = true
    onSound?.('timeUp')
    onFinish({
      correctCount,
      ...calculateScore({ correctCount, incorrectCount, passCount: finalPassCount }),
      averageAnswerSeconds: correctCount === 0 ? 0 : totalCorrectAnswerMs.current / correctCount / 1000,
    })
  }

  function updateRemaining(timeLeft: number) {
    setRemaining(timeLeft)
    const seconds = Math.ceil(timeLeft / 1000)
    if (seconds >= 1 && seconds <= 3 && seconds !== lastCountdownSecond.current) {
      lastCountdownSecond.current = seconds
      onSound?.('countdown')
    }
  }

  function nextQuestion(now: number) {
    questionStartedAt.current = now
    setQuestion(generateQuestion(level, mode))
  }

  function handleKey(key: string) {
    if (finished.current) return
    const now = performance.now()
    if (now >= deadline.current) {
      finish()
      return
    }

    switch (key) {
      case 'C':
        setAnswer('')
        return
      case 'pass': {
        const nextPassCount = passCount + 1
        deadline.current -= PASS_PENALTY_MS
        const timeLeft = Math.max(0, deadline.current - now)
        updateRemaining(timeLeft)
        if (timeLeft === 0) {
          finish(nextPassCount)
          return
        }
        setPassCount(nextPassCount)
        setAnswer('')
        nextQuestion(now)
        return
      }
      case 'Enter':
        if (answer === '') return
        setAnswer('')
        if (isCorrectAnswer(question, answer)) {
          onSound?.('correct')
          totalCorrectAnswerMs.current += now - questionStartedAt.current
          setCorrectCount(correctCount + 1)
          nextQuestion(now)
        } else {
          onSound?.('incorrect')
          setIncorrectCount(incorrectCount + 1)
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
    handleKey(key)
  })

  const updateTimer = useEffectEvent(() => {
    const timeLeft = Math.max(0, deadline.current - performance.now())
    if (finished.current) return
    updateRemaining(timeLeft)
    if (timeLeft === 0) finish()
  })

  useEffect(() => {
    const now = performance.now()
    questionStartedAt.current = now
    lastCountdownSecond.current = 0
    deadline.current = now + duration * 1000
    const interval = window.setInterval(updateTimer, 50)
    const timeout = window.setTimeout(updateTimer, duration * 1000)
    const onKeyDown = (event: KeyboardEvent) => handleKeyboard(event)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(timeout)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [duration])

  const percentage = remaining / (duration * 1000) * 100
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
        <span className="game-answer" aria-label="入力した答え">{answer.replace('-', '−')}</span>
      </div>
      <div className="game-keypad" role="group" aria-label="テンキー">
        {keypad.map((key) => (
          <button
            key={key}
            type="button"
            className={`game-key game-key-${key === '.' ? 'decimal' : key === '−' ? 'minus' : key}`}
            onClick={() => handleKey(key === '−' ? '-' : key)}
          >
            {key}
          </button>
        ))}
      </div>
      <div className="game-shortcuts">
        <span>Enter：決定</span>
        <span>Backspace：クリア</span>
        <button type="button" onClick={() => handleKey('pass')}>Tab：パス</button>
      </div>
    </main>
  )
}
