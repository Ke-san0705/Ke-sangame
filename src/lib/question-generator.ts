export type Level = 1 | 2 | 3 | 4 | 5

type Random = () => number
type Range = readonly [min: number, max: number]
type Ranges = readonly [left: Range, right: Range]
type Operands = readonly [left: bigint, right: bigint]
type Expression = { text: string; value: bigint; key: string }

const HISTORY_SIZE = 5
// Operands have at most one decimal place. Their products need two.
const SCALE = 100n

function draw(random: Random, [min, max]: Range) {
  return min + Math.floor(random() * (max - min + 1))
}

function samplePair(random: Random, [left, right]: Ranges): Operands {
  return [BigInt(draw(random, left)) * SCALE, BigInt(draw(random, right)) * SCALE]
}

function sampleDivision(random: Random, [[min, max], divisorRange]: Ranges, level: Level): Operands {
  const divisor = draw(random, divisorRange)
  const maxQuotient = level === 1 ? 9 : Math.floor(max / divisor)
  const quotient = draw(random, [Math.ceil(min / divisor), maxQuotient])
  return [BigInt(divisor * quotient) * SCALE, BigInt(divisor) * SCALE]
}

type OperationDefinition = {
  symbol: string
  commutative: boolean
  additive?: boolean
  decimalsFrom?: Level
  ranges: Record<Level, Ranges>
  sample: (random: Random, ranges: Ranges, level: Level) => Operands
  calculate: (left: bigint, right: bigint) => bigint
}

const definitions = {
  addition: {
    symbol: '+',
    commutative: true,
    additive: true,
    decimalsFrom: 2,
    ranges: {
      1: [[1, 99], [1, 9]],
      2: [[1, 999], [1, 99]],
      3: [[1, 9999], [1, 999]],
      4: [[1000, 9999], [1000, 9999]],
      5: [[1000, 9999], [1000, 9999]],
    },
    sample: samplePair,
    calculate: (left, right) => left + right,
  },
  subtraction: {
    symbol: '−',
    commutative: false,
    additive: true,
    decimalsFrom: 2,
    ranges: {
      1: [[10, 99], [1, 9]],
      2: [[1, 999], [1, 99]],
      3: [[1, 9999], [1, 999]],
      4: [[1000, 9999], [1000, 9999]],
      5: [[1000, 9999], [1000, 9999]],
    },
    sample: (random, [leftRange, rightRange], level) => {
      const left = draw(random, leftRange)
      const rightMax = level <= 2 ? Math.min(rightRange[1], left) : rightRange[1]
      return [BigInt(left) * SCALE, BigInt(draw(random, [rightRange[0], rightMax])) * SCALE]
    },
    calculate: (left, right) => left - right,
  },
  multiplication: {
    symbol: '×',
    commutative: true,
    decimalsFrom: 3,
    ranges: {
      1: [[1, 9], [1, 9]],
      2: [[10, 99], [1, 99]],
      3: [[1, 999], [1, 99]],
      4: [[1, 999], [1, 999]],
      5: [[1, 9999], [1, 999]],
    },
    sample: samplePair,
    calculate: (left, right) => (left * right) / SCALE,
  },
  division: {
    symbol: '÷',
    commutative: false,
    ranges: {
      1: [[1, 81], [1, 9]],
      2: [[10, 999], [1, 9]],
      3: [[1, 999], [1, 99]],
      4: [[1, 9999], [1, 99]],
      5: [[1, 9999], [1, 999]],
    },
    sample: sampleDivision,
    calculate: (left, right) => (left * SCALE) / right,
  },
} satisfies Record<string, OperationDefinition>

export type Operation = keyof typeof definitions
export type QuestionMode = Operation | 'mix'

export type Question = {
  operation: Operation
  expression: string
  /** Exact decimal representation for display and answer checking. */
  answer: string
}

const operations = Object.keys(definitions) as Operation[]

function format(value: bigint) {
  const sign = value < 0n ? '-' : ''
  const magnitude = value < 0n ? -value : value
  const whole = magnitude / SCALE
  const fraction = String(magnitude % SCALE).padStart(2, '0').replace(/0+$/, '')
  return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`
}

function literal(value: bigint): Expression {
  const text = value < 0n ? `(−${format(-value)})` : format(value)
  return { value, text, key: String(value) }
}

function combine(
  operation: Operation,
  left: Expression,
  right: Expression,
  groupRight = false,
): Expression {
  const { calculate, commutative, symbol } = definitions[operation]
  const keys = [left.key, right.key]
  if (commutative) keys.sort()
  return {
    text: `${left.text} ${symbol} ${groupRight ? `(${right.text})` : right.text}`,
    value: calculate(left.value, right.value),
    key: `${symbol}(${keys.join(',')})`,
  }
}

function signed(random: Random, value: bigint) {
  return random() < 0.3 ? -value : value
}

function sampleExpression(operation: Operation, level: Level, random: Random, plain = false) {
  const definition: OperationDefinition = definitions[operation]
  const ranges = definition.ranges[level]
  const decimal = !plain && definition.decimalsFrom !== undefined
    && level >= definition.decimalsFrom
    && random() < 0.25

  function decimalOperand(range: Range) {
    const wholeLimit = Math.min(level === 2 ? 10 : 100, range[1])
    const index = draw(random, [0, wholeLimit * 9 - 1])
    return BigInt(Math.floor(index / 9) * 10 + (index % 9) + 1) * 10n
  }

  let [left, right] = decimal
    ? [decimalOperand(ranges[0]), decimalOperand(ranges[1])]
    : definition.sample(random, ranges, level)
  if (decimal && level === 2 && operation === 'subtraction' && left < right) {
    const smaller = left
    left = right
    right = smaller
  }

  if (!plain && level >= 3) {
    left = signed(random, left)
    right = signed(random, right)
  }

  const first = literal(left)
  const second = literal(right)
  if (!plain && definition.additive && level >= 4 && random() < (level === 4 ? 0.25 : 0.65)) {
    const extra = decimal ? decimalOperand(ranges[1]) : BigInt(draw(random, ranges[1])) * SCALE
    const third = literal(signed(random, extra))
    if (level === 4 || random() < 0.5) {
      return combine(operation, first, combine('subtraction', second, third), true)
    }
    return combine(operation, combine(operation, first, second), third)
  }

  return combine(operation, first, second)
}

/** Create a generator for one play session. The random source returns values in [0, 1). */
export function createQuestionGenerator(random: Random = Math.random) {
  const recent: string[] = []

  return (level: Level, mode: QuestionMode): Question => {
    const operation = mode === 'mix' ? operations[draw(random, [0, operations.length - 1])] : mode
    let expression = sampleExpression(operation, level, random)
    for (let attempt = 0; recent.includes(expression.key); attempt++) {
      // After random retries, sample distinct points across the base ranges.
      // Each operation has at least six distinct base questions at these points.
      expression = attempt < 8
        ? sampleExpression(operation, level, random)
        : sampleExpression(operation, level, () => (attempt - 8 + 0.5) / (HISTORY_SIZE + 1), true)
    }

    recent.push(expression.key)
    if (recent.length > HISTORY_SIZE) recent.shift()
    return { operation, expression: expression.text, answer: format(expression.value) }
  }
}

function normalizeDecimal(text: string) {
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text.trim())
  if (!match || !(match[2] || match[3])) return null

  const whole = match[2].replace(/^0+/, '') || '0'
  const fraction = (match[3] ?? '').replace(/0+$/, '')
  const sign = match[1] === '-' && (whole !== '0' || fraction) ? '-' : ''
  return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`
}

export function isCorrectAnswer(question: Pick<Question, 'answer'>, input: string) {
  const answer = normalizeDecimal(question.answer)
  return answer !== null && normalizeDecimal(input) === answer
}
