import type { Enemy, EnemyApproach } from './enemyApproach'
import { ENEMY_SPAWN_ORDER, ENEMY_TYPES } from './enemyApproachConfig'
import { RELEASE } from './releaseConfig'

export type ReleaseResult = {
  tier: typeof RELEASE.tiers[number]['tier']
  koCount: number
  distanceKm: number
}

type ReleaseTarget = { enemy: Enemy; reinforcement: boolean; lane: number }

export type ReleasePlan = {
  result: ReleaseResult
  startingKo: number
  waves: { at: number; koCount: number; targets: ReleaseTarget[] }[]
}

export function planRelease(
  power: number,
  { enemies, nextEnemyId, defeated }: Pick<EnemyApproach, 'enemies' | 'nextEnemyId'> & { defeated: number },
): ReleasePlan {
  const profile = RELEASE.tiers.reduce((current, tier) => power >= tier.minPower ? tier : current)
  const { nearX, farX, lanes } = RELEASE.crowd
  const interval = (RELEASE.aftermathMs - RELEASE.firstStrikeMs) / profile.waves
  let koCount = defeated
  const waves = Array.from({ length: profile.waves }, (_, wave) => {
    const targets: ReleaseTarget[] = enemies
      .filter((_, index) => index % profile.waves === wave)
      .map((enemy) => ({ enemy, reinforcement: false, lane: 0 }))
    const first = Math.floor(profile.reinforcements * wave / profile.waves)
    const end = Math.floor(profile.reinforcements * (wave + 1) / profile.waves)
    for (let index = first; index < end; index++) {
      const id = nextEnemyId + index
      const type = ENEMY_SPAWN_ORDER[id % ENEMY_SPAWN_ORDER.length]
      const slot = index - first
      const x = nearX + (farX - nearX) * slot / Math.max(1, end - first - 1)
      targets.push({ enemy: { id, type, x, hp: ENEMY_TYPES[type].durability }, reinforcement: true, lane: 1 + slot % lanes })
    }
    koCount += targets.length
    return { at: RELEASE.firstStrikeMs + wave * interval, targets, koCount }
  })
  return {
    startingKo: defeated,
    waves,
    result: {
      tier: profile.tier,
      koCount,
      distanceKm: RELEASE.distancePerPowerSquared * power ** 2,
    },
  }
}

export function breaksPlanet(release: ReleaseResult) {
  return RELEASE.tiers[release.tier - 1].minPower >= RELEASE.planetBreakPower
}
