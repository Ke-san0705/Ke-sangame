import { SETSUNA, setsunaDifficulties, type SetsunaDifficulty } from './setsunaConfig'

export function reactionLimit(defeated: number) {
  const { initialMs, fasterPerWinMs, minMs } = SETSUNA.cpu
  return Math.max(minMs, initialMs - fasterPerWinMs * defeated)
}

export function createDuel(difficulty: SetsunaDifficulty, defeated: number, random = Math.random) {
  const { minMs, maxMs } = SETSUNA.wait
  const { maxOperand, twoDigitMin } = SETSUNA.question
  const waitMs = minMs + Math.floor(random() * (maxMs - minMs + 1))
  const { twoDigitAfterWins, initialChance, chancePerWin, maxChance } = setsunaDifficulties[difficulty]
  const winsPastThreshold = defeated - twoDigitAfterWins
  if (winsPastThreshold >= 0 && random() < Math.min(maxChance, initialChance + winsPastThreshold * chancePerWin)) {
    const minLeft = twoDigitMin - maxOperand
    const left = minLeft + Math.floor(random() * (maxOperand - minLeft + 1))
    const minRight = twoDigitMin - left
    const right = minRight + Math.floor(random() * (maxOperand - minRight + 1))
    return { waitMs, expression: `${left} ＋ ${right}`, answer: left + right }
  }

  const addition = random() < 0.5
  const left = Math.floor(random() * (maxOperand + 1))
  const right = Math.floor(random() * (addition ? maxOperand - left + 1 : left + 1))
  return {
    waitMs,
    expression: `${left} ${addition ? '＋' : '−'} ${right}`,
    answer: addition ? left + right : left - right,
  }
}

export function judgeDuel(input: number | null, answer: number, elapsedMs: number, limitMs: number, earlyCount = 0) {
  if (elapsedMs < 0) return earlyCount + 1 < SETSUNA.maxFalseStarts ? 'early' : 'falseStart'
  if (elapsedMs >= limitMs) return 'slow'
  return input === answer ? 'win' : 'wrong'
}

type SetsunaBest = { fastestMs: number | null; defeated: number }

const bestKey = 'ke-sangame:setsuna-best'

export function readSetsunaBest(): SetsunaBest {
  try {
    const best: Partial<SetsunaBest> | null = JSON.parse(localStorage.getItem(bestKey) ?? 'null')
    const fastestMs = best?.fastestMs
    const defeated = best?.defeated
    return {
      fastestMs: typeof fastestMs === 'number' && Number.isFinite(fastestMs) && fastestMs >= 0 ? fastestMs : null,
      defeated: typeof defeated === 'number' && Number.isSafeInteger(defeated)
        && defeated >= 0 ? defeated : 0,
    }
  } catch {
    return { fastestMs: null, defeated: 0 }
  }
}

export function saveSetsunaBest(reactionMs: number | null, defeated: number): SetsunaBest {
  const previous = readSetsunaBest()
  const best = {
    fastestMs: reactionMs === null ? previous.fastestMs : Math.min(reactionMs, previous.fastestMs ?? Infinity),
    defeated: Math.max(defeated, previous.defeated),
  }
  try {
    localStorage.setItem(bestKey, JSON.stringify({ version: 2, ...best }))
  } catch {
    // The result can still show the record when storage is unavailable.
  }
  return best
}

export function formatReaction(ms: number) {
  return `${(ms / 1000).toFixed(3)}秒`
}
