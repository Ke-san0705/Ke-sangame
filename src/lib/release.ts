import { RELEASE } from './releaseConfig'

export type ReleaseResult = {
  tier: typeof RELEASE.tiers[number]['tier']
  koCount: number
  distanceKm: number
}

export function calculateRelease(power: number): ReleaseResult {
  const profile = RELEASE.tiers.reduce((current, tier) => power >= tier.minPower ? tier : current)
  return {
    tier: profile.tier,
    koCount: power * RELEASE.koPerPower,
    distanceKm: RELEASE.distancePerPowerSquared * power ** 2,
  }
}

export function breaksPlanet(release: ReleaseResult) {
  return RELEASE.tiers[release.tier - 1].minPower >= RELEASE.planetBreakPower
}
