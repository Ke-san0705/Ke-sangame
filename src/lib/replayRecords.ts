import type { ReleaseResult } from './release'

export type ReplayRecords = {
  totalKoCount: number
  maxDistanceKm: number
  earthExplosionCount: number
}

const storageKey = 'ke-sangame:replay-records'

function readCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

export function readReplayRecords(): ReplayRecords {
  try {
    const saved: Partial<ReplayRecords> | null = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    return {
      totalKoCount: readCount(saved?.totalKoCount),
      maxDistanceKm: readCount(saved?.maxDistanceKm),
      earthExplosionCount: readCount(saved?.earthExplosionCount),
    }
  } catch {
    return { totalKoCount: 0, maxDistanceKm: 0, earthExplosionCount: 0 }
  }
}

export function saveReplayRecords(release: ReleaseResult) {
  const previous = readReplayRecords()
  const records = {
    totalKoCount: previous.totalKoCount + release.koCount,
    maxDistanceKm: Math.max(previous.maxDistanceKm, release.distanceKm),
    earthExplosionCount: previous.earthExplosionCount + (release.tier === 3 ? 1 : 0),
  }
  const updated = {
    totalKoCount: records.totalKoCount > previous.totalKoCount,
    maxDistanceKm: records.maxDistanceKm > previous.maxDistanceKm,
    earthExplosionCount: records.earthExplosionCount > previous.earthExplosionCount,
  }

  try {
    localStorage.setItem(storageKey, JSON.stringify(records))
    return { records, updated }
  } catch {
    return undefined
  }
}
