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
const symbols = { addition: '+', subtraction: '−', multiplication: '×', division: '÷' }
const maxima = [
  [[99, 9], [99, 9], [9, 9], [81, 9]],
  [[999, 99], [999, 99], [99, 99], [999, 9]],
  [[9999, 999], [9999, 999], [999, 99], [999, 99]],
  [[9999, 9999], [9999, 9999], [999, 999], [9999, 99]],
  [[9999, 9999], [9999, 9999], [9999, 999], [9999, 999]],
]

function nextMany(level: Level, operation: Operation | 'mix', count = 200) {
  const next = createQuestionGenerator(seededRandom())
  return Array.from({ length: count }, () => next(level, operation))
}

// Evaluate only generated arithmetic tokens in tests, independently of the generator.
function evaluate(expression: string) {
  const tokens = expression.split(' ').join('').match(/\d+(?:\.\d+)?|[+−×÷()-]/g) ?? []
  let cursor = 0

  function operand(): number {
    const token = tokens[cursor++]
    if (token === '-') return -operand()
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
      const values = question.expression.match(/\d+(?:\.\d+)?/g)!.map(Number)
      const [left, right, third] = values
      expect(left).toBeGreaterThan(0)
      expect(left).toBeLessThanOrEqual(leftMax)
      expect(right).toBeGreaterThan(0)
      expect(right).toBeLessThanOrEqual(rightMax)
      if (third !== undefined) expect(third).toBeLessThanOrEqual(rightMax)

      const answer = Number(question.answer)
      expect(answer).toBeCloseTo(evaluate(question.expression), 7)

      if (operation === 'division') {
        expect(Number.isInteger(answer)).toBe(true)
        expect(left % right).toBe(0)
        if (level === 1) expect(Math.abs(answer)).toBeLessThanOrEqual(9)
        if (level === 2) expect(left).toBeGreaterThanOrEqual(10)
      }
      if (level === 1 && operation === 'subtraction') {
        expect(left).toBeGreaterThanOrEqual(10)
        expect(answer).toBeGreaterThanOrEqual(0)
      }
      if (level === 2 && operation === 'multiplication') expect(left).toBeGreaterThanOrEqual(10)
      if (level >= 4 && (operation === 'addition' || operation === 'subtraction') && !question.expression.includes('.')) {
        expect(values.every((value) => value >= 1000)).toBe(true)
      }
    }
  })

  it('mix uses all four operations within the same level', () => {
    const questions = nextMany(level, 'mix')
    expect(new Set(questions.map(({ operation }) => operation))).toEqual(new Set(operations))
    for (const { operation, expression, answer } of questions) {
      const [leftMax, rightMax] = maxima[level - 1][operations.indexOf(operation)]
      const [left, ...rest] = expression.match(/\d+(?:\.\d+)?/g)!.map(Number)
      expect(left).toBeLessThanOrEqual(leftMax)
      expect(rest.every((value) => value <= rightMax)).toBe(true)
      expect(Number(answer)).toBeCloseTo(evaluate(expression), 7)
      if (operation === 'division') expect(Number.isInteger(Number(answer))).toBe(true)
    }
  })
})

it('introduces decimals, signed operands, grouping and chains at the specified levels', () => {
  expect(nextMany(1, 'mix').every(({ expression }) => !/[.()-]/.test(expression))).toBe(true)
  for (const operation of ['addition', 'subtraction'] as const) {
    const level2 = nextMany(2, operation)
    expect(level2.some(({ expression }) => expression.includes('.'))).toBe(true)
    expect(level2.every(({ expression }) => !/[()-]/.test(expression))).toBe(true)
    expect(nextMany(3, operation).some(({ expression }) => expression.includes('-'))).toBe(true)
    expect(nextMany(4, operation).some(({ expression }) => /\([^()]* [−+] /.test(expression))).toBe(true)
    const level5 = nextMany(5, operation)
    expect(level5.some(({ expression }) => /\([^()]* [−+] /.test(expression) && /[.-]/.test(expression))).toBe(true)
    expect(level5.some(({ expression }) => expression.split(' ').length === 5 && !expression.includes('('))).toBe(true)
  }
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
  { operation: 'addition', first: [0.025, 0.5], reverse: [0, 0.045, 0.25], original: '3 + 5', swapped: '5 + 3' },
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
  const multiplication = createQuestionGenerator(() => multiplicationDraws.shift() ?? 0)(3, 'multiplication')
  expect(multiplication.expression).toBe('0.1 × -0.2')
  expect(multiplication.answer).toBe('-0.02')
})
