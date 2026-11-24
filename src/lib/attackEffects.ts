import { ATTACK_STAGES } from './enemyApproachConfig'
import type { Enemy } from './enemyApproach'
import type { SoundCue } from './soundEffects'

const profiles = {
  slash: { color: '#bfdbfe', duration: 0.38, travel: 40, sound: 'slash' },
  flying: { color: '#38bdf8', duration: 0.53, travel: 700, sound: 'flying' },
  shockwave: { color: '#2563eb', duration: 0.5, travel: 120, sound: 'shockwave' },
  strongShockwave: { color: '#c084fc', duration: 0.55, travel: 145, sound: 'strongShockwave' },
} as const satisfies Record<string, {
  color: string; duration: number; travel: number; sound: SoundCue
}>

export type AttackShape = keyof typeof profiles

export const ATTACK_EFFECTS = {
  overlap: 'compose' as 'compose' | 'replace',
  maxLayers: 3,
  maxImpacts: 8,
  width: 800,
  height: 450,
  baseline: 285,
  maxScreenX: 775,
  defaultSlashX: 215,
  flyingTipX: 75,
  flyingTravelDuration: 0.23,
  windup: 0.055,
  shortDuration: 0.21,
  hero: { windupX: -4, strikeX: 13, angle: 6 },
  impact: { travel: 68, lift: -35, angle: 25, duration: 0.25 },
}

export function attackEffectForStage(stage: number) {
  const shape = ATTACK_STAGES.find((entry) => entry.stage === stage)?.effect ?? 'slash'
  return { shape, ...profiles[shape] }
}

export type AttackVisual = {
  id: number
  stage: number
  targets: readonly Enemy[]
}

export function queueAttackVisual(current: readonly AttackVisual[], attack: AttackVisual) {
  return ATTACK_EFFECTS.overlap === 'replace' ? [attack] : [...current, attack].slice(-ATTACK_EFFECTS.maxLayers)
}
