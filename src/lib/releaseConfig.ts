export const RELEASE = {
  color: '#fef3c7',
  distancePerPowerSquared: 5,
  planetBreakPower: 400,
  endMs: 3_600,
  firstStrikeMs: 450,
  aftermathMs: 3_000,
  crowd: {
    startX: 1.08,
    nearX: 0.42,
    farX: 0.91,
    lanes: 3,
    laneStep: 6,
  },
  tiers: [
    { tier: 1, waves: 3, reinforcements: 6, minPower: 0, label: '通常解放', glow: 0.48, reach: 0.66, sparks: 16, shake: 3, volume: 0.45 },
    { tier: 2, waves: 4, reinforcements: 12, minPower: 200, label: '強化解放', glow: 0.63, reach: 0.82, sparks: 24, shake: 6, volume: 0.60 },
    { tier: 3, waves: 5, reinforcements: 20, minPower: 400, label: '極限解放', glow: 0.80, reach: 1, sparks: 36, shake: 9, volume: 0.76 },
    { tier: 4, waves: 6, reinforcements: 30, minPower: 600, label: '限界突破', glow: 0.96, reach: 1.2, sparks: 48, shake: 13, volume: 0.90 },
  ],
  particles: {
    angleStep: 137.508,
    minDistance: 15,
    distanceStep: 5,
    distanceVariants: 7,
    delayStepMs: 18,
    delayVariants: 6,
  },
} as const

export const ULTIMATE_AUDIO = {
  ultimateGather: { notes: [110, 165, 220, 330], waveform: 'sine', spacing: 0.10, duration: 0.24 },
  ultimateSlash: { notes: [960, 480, 240], waveform: 'triangle', spacing: 0.025, duration: 0.14 },
  ultimateBlast: { notes: [120, 68, 45], waveform: 'sawtooth', spacing: 0.055, duration: 0.44 },
} as const
