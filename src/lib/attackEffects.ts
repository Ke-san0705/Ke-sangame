import { ATTACK_STAGES } from './enemyApproachConfig'
import type { EnemyHit } from './combat'
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
  knockback: {
    small: { lift: 0.32, rotation: 340, durationMs: 340 },
    golem: { lift: 0.48, rotation: 450, durationMs: 420 },
    exitX: 1.10,
    stageTravel: 0.10,
    stageLift: 0.035,
    golemTravel: 0.22,
    samples: 9,
    flinch: { travelPx: 7, rotation: 7, durationMs: 150 },
  },
}

export function attackEffectForStage(stage: number) {
  const shape = ATTACK_STAGES.find((entry) => entry.stage === stage)?.effect ?? 'slash'
  return { shape, ...profiles[shape] }
}

export type AttackVisual = {
  id: number
  stage: number
  hits: readonly EnemyHit[]
}

export function queueAttackVisual(current: readonly AttackVisual[], attack: AttackVisual) {
  return ATTACK_EFFECTS.overlap === 'replace' ? [attack] : [...current, attack].slice(-ATTACK_EFFECTS.maxLayers)
}
