import { readSetsunaBest } from './setsuna'
import { setsunaRanks, setsunaStrongEnemy, type SetsunaDifficulty } from './setsunaConfig'

export function rollsStrongEnemy(defeated: number, missedRolls: number, random = Math.random) {
  const { afterWins, initialPercent, increasePercent, maxPercent } = setsunaStrongEnemy
  const percent = Math.min(maxPercent, initialPercent + missedRolls * increasePercent)
  return defeated >= afterWins && random() < percent / 100
}

type DuelRecord = { wins: number; losses: number; fastestMs: number | null }
type StrongEnemyRecord = { unlocked: boolean; encounter: DuelRecord; rematch: DuelRecord }

const strongEnemyKey = (difficulty: SetsunaDifficulty) => `ke-sangame:setsuna-strong-enemy:${difficulty}`

function readDuelRecord(record?: Partial<DuelRecord>): DuelRecord {
  const { wins, losses, fastestMs } = record ?? {}
  return {
    wins: typeof wins === 'number' && Number.isSafeInteger(wins) && wins >= 0 ? wins : 0,
    losses: typeof losses === 'number' && Number.isSafeInteger(losses) && losses >= 0 ? losses : 0,
    fastestMs: typeof fastestMs === 'number' && Number.isFinite(fastestMs) && fastestMs >= 0 ? fastestMs : null,
  }
}

export function readStrongEnemy(difficulty: SetsunaDifficulty): StrongEnemyRecord {
  let record: Partial<StrongEnemyRecord> | null = null
  try {
    record = JSON.parse(localStorage.getItem(strongEnemyKey(difficulty)) ?? 'null')
  } catch {
    // Missing or unreadable storage starts with an empty record.
  }
  return {
    unlocked: record?.unlocked === true,
    encounter: readDuelRecord(record?.encounter),
    rematch: readDuelRecord(record?.rematch),
  }
}

export function saveStrongEnemy(
  difficulty: SetsunaDifficulty,
  result?: { mode: 'encounter' | 'rematch'; reactionMs: number | null },
) {
  const record = readStrongEnemy(difficulty)
  record.unlocked = true
  if (result) {
    const duel = record[result.mode]
    if (result.reactionMs === null) duel.losses++
    else {
      duel.wins++
      duel.fastestMs = Math.min(result.reactionMs, duel.fastestMs ?? Infinity)
    }
  }
  try {
    localStorage.setItem(strongEnemyKey(difficulty), JSON.stringify(record))
  } catch {
    // Keep the current result available on screen if storage is unavailable.
  }
  return record
}

export function setsunaRank(
  difficulty: SetsunaDifficulty,
  best = readSetsunaBest(difficulty),
  strongEnemy = readStrongEnemy(difficulty),
) {
  if (strongEnemy.encounter.wins || strongEnemy.rematch.wins) return '無双'
  return setsunaRanks.reduce<string>(
    (rank, { defeated, label }) => best.defeated >= defeated ? label : rank, '無段',
  )
}
