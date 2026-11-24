export const SETSUNA = {
  wait: { minMs: 1_500, maxMs: 4_000 },
  reactionLimits: [650, 450, 350, 250, 180],
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
