export const SETSUNA = {
  wait: { minMs: 1_500, maxMs: 4_000 },
  cpu: { initialMs: 1_500, fasterPerWinMs: 75, minMs: 650 },
  betweenRoundsMs: 1_250,
  maxFalseStarts: 2,
  question: { maxOperand: 9, twoDigitMin: 10, maxInputLength: 2 },
  heartbeatIntervalMs: 720,
  finish: {
    stepMs: 80,
    slashMs: 120,
    hitStopMs: 50,
    silenceMs: 200,
    fallMs: 350,
    zoom: 1.1,
    stepDistance: 5,
    passDistance: 64,
    followThroughDistance: 4,
    fallAngle: 13,
    setback: 15,
    drawFrames: 3,
  },
} as const

const { stepMs, slashMs, hitStopMs, silenceMs, fallMs } = SETSUNA.finish
export const setsunaFinishMs = stepMs + slashMs + hitStopMs + silenceMs + fallMs

export const setsunaDifficulties = {
  easy: { label: '初級', twoDigitAfterWins: 4, initialChance: 0.10, chancePerWin: 0.05, maxChance: 0.40 },
  normal: { label: '中級', twoDigitAfterWins: 3, initialChance: 0.20, chancePerWin: 0.06, maxChance: 0.60 },
  hard: { label: '上級', twoDigitAfterWins: 2, initialChance: 0.35, chancePerWin: 0.08, maxChance: 0.75 },
} as const

export type SetsunaDifficulty = keyof typeof setsunaDifficulties
export const defaultSetsunaDifficulty: SetsunaDifficulty = 'normal'
