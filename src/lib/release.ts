export const RELEASE_METER_MS = 1000
const CRITICAL_WINDOW_MS = 40

export type ReleaseResult = {
  tier: 1 | 2 | 3
  koCount: number
  distanceKm: number
}

export function calculateRelease(power: number, critical = false): ReleaseResult {
  let tier: ReleaseResult['tier'] = power >= 400 ? 3 : power >= 200 ? 2 : 1
  if (critical) tier = tier === 1 ? 2 : 3

  return {
    tier,
    koCount: power * 10,
    distanceKm: 5 * power ** 2,
  }
}

export function releaseMeterPosition(elapsedMs: number) {
  return 1 - Math.abs(1 - 2 * Math.min(1, Math.max(0, elapsedMs / RELEASE_METER_MS)))
}

export function isCriticalRelease(elapsedMs: number) {
  return [RELEASE_METER_MS / 4, RELEASE_METER_MS * 3 / 4].some(
    (center) => Math.abs(elapsedMs - center) <= CRITICAL_WINDOW_MS,
  )
}
