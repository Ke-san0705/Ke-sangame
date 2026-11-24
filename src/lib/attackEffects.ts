import { ATTACK_STAGES, COMBO_SPECIAL } from './enemyApproachConfig'
import type { Enemy } from './enemyApproach'
import type { SoundCue } from './soundEffects'

const profiles = {
  slash: { color: '#bfdbfe', reach: 130, duration: 0.38, travel: 40, sound: 'slash' },
  flying: { color: '#38bdf8', reach: 340, duration: 0.53, travel: 700, sound: 'flying' },
  shockwave: { color: '#2563eb', reach: 520, duration: 0.5, travel: 120, sound: 'shockwave' },
  cannon: { color: '#67e8f9', reach: 710, duration: 0.57, travel: 0, sound: 'cannon' },
} as const satisfies Record<string, {
  color: string; reach: number; duration: number; travel: number; sound: SoundCue
}>

export type AttackShape = keyof typeof profiles | 'comboSpecial'

export const ATTACK_EFFECTS = {
  overlap: 'compose' as 'compose' | 'replace',
  maxLayers: 3,
  maxImpacts: 8,
  special: { color: '#f59e0b', duration: 0.55, travel: 0 },
  auraPerAnswer: 0.045,
  auraMin: 0.21,
  auraReducedMax: 0.36,
  auraMax: 0.82,
  frameScales: [1.06, 1.05, 1.04, 1.03, 1.015, 1],
  width: 800,
  height: 450,
  baseline: 285,
  maxScreenX: 775,
  defaultSlashX: 215,
  flyingTipX: 75,
  flyingTravelDuration: 0.23,
  strongHeightScale: 1.3,
  strongStageIds: [4, 6],
  windup: 0.055,
  shortDuration: 0.21,
  hero: { windupX: -4, strikeX: 13, angle: 6 },
  impact: { travel: 68, lift: -35, angle: 25, duration: 0.25 },
}

export function attackEffectForStage(stage: number) {
  const shape = ATTACK_STAGES.find((entry) => entry.stage === stage)?.effect ?? 'slash'
  return { shape, ...profiles[shape] }
}

export function attackEffectForVisual(attack: AttackVisual) {
  if (!attack.special) return attackEffectForStage(attack.stage)
  return {
    shape: 'comboSpecial' as const,
    reach: COMBO_SPECIAL.range * ATTACK_EFFECTS.width,
    ...ATTACK_EFFECTS.special,
  }
}

export type AttackVisual = {
  id: number
  stage: number
  targets: readonly Enemy[]
  special?: { healed: number }
}

export function queueAttackVisual(current: readonly AttackVisual[], attack: AttackVisual) {
  return ATTACK_EFFECTS.overlap === 'replace' ? [attack] : [...current, attack].slice(-ATTACK_EFFECTS.maxLayers)
}
