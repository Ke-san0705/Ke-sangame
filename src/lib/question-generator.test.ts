import { describe, expect, it } from 'vitest'
import { createQuestionGenerator, isCorrectAnswer } from './question-generator'
import type { Level, Operation } from './question-generator'

function seededRandom() {
  let state = 42
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

const levels = [1, 2, 3, 4, 5] as const
const operations = ['addition', 'subtraction', 'multiplication', 'division'] as const
const groupedExpression = /[+−] \((?:\(−[\d.]+\)|[\d.]+) [+−] (?:\(−[\d.]+\)|[\d.]+)\)$/
const symbols = { addition: '+', subtraction: '−', multiplication: '×', division: '÷' }
const maxima = [
  [[9, 9], [18, 9], [9, 9], [81, 9]],
  [[999, 99], [999, 99], [99, 99], [999, 9]],
  [[9999, 999], [9999, 999], [99, 99], [9999, 99]],
  [[9999, 9999], [9999, 9999], [99, 999], [9999, 99]],
  [[9999, 9999], [9999, 9999], [999, 999], [9999, 999]],
]

function nextMany(level: Level, operation: Operation | 'mix', count = 200) {
  const next = createQuestionGenerator(seededRandom())
  return Array.from({ length: count }, () => next(level, operation))
}

// Evaluate only generated arithmetic tokens in tests, independently of the generator.
function evaluate(expression: string) {
  const tokens = expression.split(' ').join('').match(/\(−\d+(?:\.\d+)?\)|\d+(?:\.\d+)?|[+−×÷()]/g) ?? []
  let cursor = 0

  function operand(): number {
    const token = tokens[cursor++]
    if (token.startsWith('(−')) return -Number(token.slice(2, -1))
    if (token === '(') {
      const value = sum()
      expect(tokens[cursor++]).toBe(')')
      return value
    }
    return Number(token)
  }

  function product() {
    let value = operand()
    while (tokens[cursor] === '×' || tokens[cursor] === '÷') {
      const operator = tokens[cursor++]
      const right = operand()
      value = operator === '×' ? value * right : value / right
    }
    return value
  }

  function sum() {
    let value = product()
    while (tokens[cursor] === '+' || tokens[cursor] === '−') {
      const operator = tokens[cursor++]
      const right = product()
      value = operator === '+' ? value + right : value - right
    }
    return value
  }

  expect(tokens.join('')).toBe(expression.replaceAll(' ', ''))
  const result = sum()
  expect(cursor).toBe(tokens.length)
  return result
}

describe.each(levels)('Lv.%i', (level) => {
  it.each(operations)('%s stays within the specified range and evaluates correctly', (operation) => {
    const [leftMax, rightMax] = maxima[level - 1][operations.indexOf(operation)]

    for (const question of nextMany(level, operation)) {
      expect(question.operation).toBe(operation)
      expect(question.expression).toContain(symbols[operation])
      expect(question.expression.replaceAll(' ', '')).not.toMatch(/[+−-][−-]/)
      const values = question.expression.match(/\d+(?:\.\d+)?/g)!.map(Number)
      expect(values).toHaveLength(2)
      const [left, right] = values
      expect(left).toBeGreaterThan(0)
      expect(left).toBeLessThanOrEqual(leftMax)
      expect(right).toBeGreaterThan(0)
      expect(right).toBeLessThanOrEqual(rightMax)

      const answer = Number(question.answer)
      expect(answer).toBeCloseTo(evaluate(question.expression), 7)

      if (operation === 'division') {
        expect(Number.isInteger(answer)).toBe(true)
        expect(left % right).toBe(0)
        expect(right).toBeGreaterThan(1)
        if (level === 1) expect(Math.abs(answer)).toBeLessThanOrEqual(9)
        if (level === 2) expect(left).toBeGreaterThanOrEqual(10)
      }
      if (level === 1 && operation === 'addition') {
        expect(question.expression).toMatch(/^[1-9] \+ [1-9]$/)
        expect(answer).toBeLessThanOrEqual(18)
      }
      if (level === 1 && operation === 'subtraction') {
        expect(left).toBeGreaterThanOrEqual(2)
        expect(question.expression).toMatch(/^\d{1,2} − [1-9]$/)
        expect(question.answer).toMatch(/^\d$/)
      }
      if (level === 2 && operation === 'multiplication') {
        expect(left).toBeGreaterThanOrEqual(10)
        expect(right < 10 || right === 11 || right % 10 === 0).toBe(true)
      }
      expect(question.answer.replace(/[^0-9]/g, '').length).toBeLessThanOrEqual(6)
      if (level >= 4 && (operation === 'addition' || operation === 'subtraction') && !question.expression.includes('.')) {
        expect(values.every((value) => value >= 1000)).toBe(true)
      }
    }
  })

  it('mix uses all four operations within the same level', () => {
    const questions = nextMany(level, 'mix')
    for (const operation of operations) {
      expect(questions.filter((question) => question.operation === operation)).toHaveLength(50)
      for (let start = 0; start <= questions.length - 12; start++) {
        expect(questions.slice(start, start + 12).some((question) => question.operation === operation)).toBe(true)
      }
    }
    for (const { operation, expression, answer } of questions) {
      const [leftMax, rightMax] = maxima[level - 1][operations.indexOf(operation)]
      const [left, ...rest] = expression.match(/\d+(?:\.\d+)?/g)!.map(Number)
      expect(left).toBeLessThanOrEqual(leftMax)
      const grouped = groupedExpression.test(expression)
      expect(rest).toHaveLength(grouped ? 2 : 1)
      if (grouped) {
        expect(level).toBeGreaterThanOrEqual(4)
        expect(['addition', 'subtraction']).toContain(operation)
      }
      expect(rest.every((value) => value <= rightMax)).toBe(true)
      expect(Number(answer)).toBeCloseTo(evaluate(expression), 7)
      if (level === 1 && operation === 'addition') {
        expect(expression).toMatch(/^[1-9] \+ [1-9]$/)
        expect(Number(answer)).toBeLessThanOrEqual(18)
      }
      if (level === 1 && operation === 'subtraction') {
        expect(left).toBeGreaterThanOrEqual(2)
        expect(expression).toMatch(/^\d{1,2} − [1-9]$/)
        expect(answer).toMatch(/^\d$/)
      }
      if (operation === 'division') {
        expect(Number.isInteger(Number(answer))).toBe(true)
        expect(rest[0]).toBeGreaterThan(1)
      }
      if (level === 3 && operation === 'multiplication') {
        expect([left, ...rest].some(Number.isInteger)).toBe(true)
      }
    }
  })
})

it.each([
  { operation: 'addition', draws: [0.999, 0.999], expression: '9 + 9', answer: '18' },
  { operation: 'subtraction', draws: [0, 0.999], expression: '2 − 2', answer: '0' },
  { operation: 'subtraction', draws: [0.999, 0.999], expression: '18 − 9', answer: '9' },
] as const)('reaches the Lv.1 boundary $expression', ({ operation, draws, expression, answer }) => {
  const samples = [...draws]
  expect(createQuestionGenerator(() => samples.shift()!)(1, operation)).toEqual({
    operation, expression, answer,
  })
})

it('preserves the seeded Lv.4 grouped operands', () => {
  const questions = nextMany(4, 'mix', 20).filter(({ expression }) => groupedExpression.test(expression))
  expect(questions.map(({ expression }) => expression)).toEqual([
    '8464 − (83 − 2)',
    '8945 − (28 + 4)',
    '1695 − (48 − 1)',
  ])
})

it.each([4, 5] as const)('includes grouped two-step questions in a 20-question Lv.%i mix', (level) => {
  const grouped = nextMany(level, 'mix', 20).filter(({ expression }) => groupedExpression.test(expression))

  expect(grouped.length).toBeGreaterThanOrEqual(2)
  expect(grouped.length).toBeLessThanOrEqual(4)
  for (const { expression, answer } of grouped) {
    expect(Number(answer)).toBeCloseTo(evaluate(expression), 7)
  }
  if (level === 5) expect(grouped.some(({ expression }) => expression.includes('(−'))).toBe(true)
})

it('preserves decimals and signed operands at their respective levels', () => {
  expect(nextMany(1, 'mix').every(({ expression }) => !/[.()-]/.test(expression))).toBe(true)
  for (const operation of ['addition', 'subtraction'] as const) {
    const level2 = nextMany(2, operation)
    expect(level2.some(({ expression }) => expression.includes('.'))).toBe(true)
    expect(level2.every(({ expression }) => !/[()-]/.test(expression))).toBe(true)
    for (const level of [3, 4, 5] as const) {
      expect(nextMany(level, operation).some(({ expression }) => expression.includes('(−'))).toBe(true)
    }
  }
})

it('generates both easy multiplication forms in Lv.2 and unrestricted two-digit pairs in Lv.3', () => {
  const factors = (level: Level) => nextMany(level, 'multiplication')
    .map(({ expression }) => expression.match(/\d+(?:\.\d+)?/g)!.map(Number))
  const level2 = factors(2)
  expect(level2.some(([, right]) => right < 10)).toBe(true)
  expect(level2.some(([, right]) => right >= 10)).toBe(true)
  const level3 = factors(3)
  expect(level3.every((pair) => pair.some(Number.isInteger))).toBe(true)
  expect(level3.some((pair) => pair.some((value) => !Number.isInteger(value)))).toBe(true)
  expect(level3.some((pair) => pair.every((value) =>
    Number.isInteger(value) && value > 11 && value % 10 !== 0,
  ))).toBe(true)
})

it('generates both two-digit and three-digit quotients in Lv.3 division', () => {
  const quotients = nextMany(3, 'division').map(({ answer }) => Math.abs(Number(answer)))
  expect(quotients.every((value) => value >= 10 && value <= 999)).toBe(true)
  expect(quotients.filter((value) => value < 100).length).toBeGreaterThan(20)
  expect(quotients.filter((value) => value >= 100).length).toBeGreaterThan(20)
})

it('uses only two- or three-digit quotients in a 20-question Lv.5 mix', () => {
  const quotients = nextMany(5, 'mix', 20)
    .filter(({ operation }) => operation === 'division')
    .map(({ answer }) => Math.abs(Number(answer)))

  expect(quotients).toHaveLength(5)
  expect(quotients.every((value) => value >= 10 && value <= 999)).toBe(true)
  expect(quotients.some((value) => value < 100)).toBe(true)
  expect(quotients.some((value) => value >= 100)).toBe(true)
})

it('keeps Lv.5 division in range even when the random source repeats', () => {
  const next = createQuestionGenerator(() => 0)
  const questions = Array.from({ length: 16 }, () => next(5, 'division'))

  for (const [index, { expression, answer }] of questions.entries()) {
    const [dividend, divisor] = expression.match(/\d+/g)!.map(Number)
    expect(dividend).toBeGreaterThanOrEqual(1000)
    expect(dividend).toBeLessThanOrEqual(9999)
    expect(divisor).toBeGreaterThanOrEqual(10)
    expect(divisor).toBeLessThanOrEqual(999)
    expect(Math.abs(Number(answer))).toBeGreaterThanOrEqual(10)
    expect(Math.abs(Number(answer))).toBeLessThanOrEqual(999)
    expect(Number(answer)).toBe(evaluate(expression))
    expect(questions.slice(Math.max(0, index - 5), index).map((question) => question.expression))
      .not.toContain(expression)
  }
})

it.each([
  { level: 3, operation: 'division', draws: [0, 0, 0, 0], expression: '(−20) ÷ (−2)' },
  { level: 4, operation: 'subtraction', draws: [0.5, 0.82175, 0.9338, 0.5, 0, 0.5], expression: '8395 − (−9404)' },
  { level: 4, operation: 'addition', draws: [0.5, 0, 0, 0, 0, 0, 0, 0], expression: '(−1000) + (−1000)' },
  { level: 5, operation: 'addition', draws: [0.5, 0.809, 0.6967, 0.5, 0, 0, 0.1975, 0.5, 0.5], expression: '8281 + (−7270)' },
] as const)('formats Lv.$level $operation as $expression', ({ level, operation, draws, expression }) => {
  const samples = [...draws]
  const next = createQuestionGenerator(() => samples.shift()!)
  expect(next(level, operation).expression).toBe(expression)
})

it.each(operations)('excludes the last five %s questions even when the random source repeats', (operation) => {
  const next = createQuestionGenerator(() => 0)
  const expressions = Array.from({ length: 16 }, () => next(1, operation).expression)
  for (const [index, expression] of expressions.entries()) {
    expect(expressions.slice(Math.max(0, index - 5), index)).not.toContain(expression)
  }
  expect(expressions[6]).toBe(expressions[0])
})

it.each([
  { operation: 'addition', first: [0.25, 0.5], reverse: [0, 0.5, 0.25], original: '3 + 5', swapped: '5 + 3' },
  { operation: 'multiplication', first: [0, 0.5], reverse: [0.5, 0.5, 0], original: '1 × 5', swapped: '5 × 1' },
] as const)('excludes reversed operands for $operation across mode changes', ({ operation, first, reverse, original, swapped }) => {
  const draws = [...first, ...reverse]
  const next = createQuestionGenerator(() => draws.shift() ?? 0)
  const reverseDraws = [...reverse]
  expect(createQuestionGenerator(() => reverseDraws.shift() ?? 0)(1, 'mix').expression).toBe(swapped)
  expect(next(1, operation).expression).toBe(original)
  expect(next(1, 'mix').expression).not.toBe(swapped)
})

it('calculates decimals exactly and accepts equivalent decimal input', () => {
  const draws = [0, 0, 0.015]
  const question = createQuestionGenerator(() => draws.shift() ?? 0)(2, 'addition')
  expect(question).toEqual({ operation: 'addition', expression: '0.1 + 0.2', answer: '0.3' })
  expect(isCorrectAnswer(question, '0.300')).toBe(true)
  expect(isCorrectAnswer({ answer: '1.5' }, '1.50')).toBe(true)
  expect(isCorrectAnswer({ answer: '-1.5' }, '-01.500')).toBe(true)
  expect(isCorrectAnswer({ answer: '0' }, '-0.00')).toBe(true)
  for (const input of ['', '3/10', '3e-1', '0.3000000000000000001']) {
    expect(isCorrectAnswer(question, input)).toBe(false)
  }
})

it('keeps exact answers when subtracting and multiplying decimal operands', () => {
  const subtractionDraws = [0, 0.015, 0]
  const subtraction = createQuestionGenerator(() => subtractionDraws.shift() ?? 0)(2, 'subtraction')
  expect(subtraction.expression).toBe('0.2 − 0.1')
  expect(subtraction.answer).toBe('0.1')

  const multiplicationDraws = [0, 0, 0.002, 0.5, 0]
  const multiplication = createQuestionGenerator(() => multiplicationDraws.shift() ?? 0)(4, 'multiplication')
  expect(multiplication.expression).toBe('0.1 × (−0.2)')
  expect(multiplication.answer).toBe('-0.02')
})
