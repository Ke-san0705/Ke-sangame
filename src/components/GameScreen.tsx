import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { createQuestionGenerator, isCorrectAnswer } from '../lib/question-generator'
import type { Level, QuestionMode } from '../lib/question-generator'
import './GameScreen.css'

const PASS_PENALTY_MS = 3_000
const KEYPAD_ROWS = ['7', '8', '9', 'C', '4', '5', '6', 'pass', '1', '2', '3', 'Enter']

export type GameResult = {
  correctCount: number
  missCount: number
}

type GameScreenProps = {
  level: Level
  mode: QuestionMode
  duration: number
  onFinish: (result: GameResult) => void
}

export function GameScreen({ level, mode, duration, onFinish }: GameScreenProps) {
  const [{ generateQuestion, firstQuestion }] = useState(() => {
    const generateQuestion = createQuestionGenerator()
    return { generateQuestion, firstQuestion: generateQuestion(level, mode) }
  })
  const [question, setQuestion] = useState(firstQuestion)
  const [answer, setAnswer] = useState('')
  const [correctCount, setCorrectCount] = useState(0)
  const [missCount, setMissCount] = useState(0)
  const [remaining, setRemaining] = useState(duration * 1000)
  const deadline = useRef(0)
  const finished = useRef(false)

  const acceptsDecimal = level >= 2
  const acceptsNegative = level >= 3

  function finish(finalMissCount = missCount) {
    if (finished.current) return
    finished.current = true
    onFinish({ correctCount, missCount: finalMissCount })
  }

  function nextQuestion() {
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
        const nextMissCount = missCount + 1
        deadline.current -= PASS_PENALTY_MS
        const timeLeft = Math.max(0, deadline.current - now)
        setRemaining(timeLeft)
        if (timeLeft === 0) {
          finish(nextMissCount)
          return
        }
        setMissCount(nextMissCount)
        setAnswer('')
        nextQuestion()
        return
      }
      case 'Enter':
        if (answer === '') return
        setAnswer('')
        if (isCorrectAnswer(question, answer)) {
          setCorrectCount(correctCount + 1)
          nextQuestion()
        } else {
          setMissCount(missCount + 1)
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
    setRemaining(timeLeft)
    if (timeLeft === 0) finish()
  })

  useEffect(() => {
    deadline.current = performance.now() + duration * 1000
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
        <span className="game-misses">ミス {missCount}</span>
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
