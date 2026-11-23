export const reactionLimits = [650, 450, 350, 250, 180] as const

export function createDuel(random = Math.random) {
  const waitMs = 1500 + Math.floor(random() * 2501)
  const addition = random() < 0.5
  const left = Math.floor(random() * 10)
  const right = Math.floor(random() * (addition ? 10 - left : left + 1))
  return {
    waitMs,
    expression: `${left} ${addition ? '＋' : '−'} ${right}`,
    answer: addition ? left + right : left - right,
  }
}

export function judgeDuel(input: number, answer: number, elapsedMs: number, enemy: number, earlyCount = 0) {
  if (elapsedMs < 0) return earlyCount === 0 ? 'early' : 'falseStart'
  if (input !== answer) return 'wrong'
  return elapsedMs < reactionLimits[enemy] ? 'win' : 'slow'
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
      defeated: typeof defeated === 'number' && Number.isInteger(defeated)
        && defeated >= 0 && defeated <= reactionLimits.length ? defeated : 0,
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
    localStorage.setItem(bestKey, JSON.stringify(best))
  } catch {
    // The result can still show the record when storage is unavailable.
  }
  return best
}

export function formatReaction(ms: number) {
  return `${(ms / 1000).toFixed(3)}秒`
}
