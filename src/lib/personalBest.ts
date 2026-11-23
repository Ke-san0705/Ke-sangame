import type { PlayMode } from './gameMode'

function personalBestKey({ operation, level, duration }: PlayMode) {
  return `ke-sangame:personal-best:${operation}:${level}:${duration}`
}

function readPersonalBest(key: string, duration: PlayMode['duration']) {
  const saved = window.localStorage.getItem(key)
  const legacyScore = saved?.trim() ? Number(saved) : NaN
  if (Number.isSafeInteger(legacyScore)) return { score: legacyScore }
  if (!saved || duration === 'survival') return

  try {
    const record = JSON.parse(saved) as { score?: unknown; curve?: unknown } | null
    if (typeof record?.score !== 'number' || !Number.isSafeInteger(record.score)) return
    const { score, curve } = record
    const validCurve = Array.isArray(curve) && curve.length === duration + 1
      && curve.every((count, second) =>
        Number.isSafeInteger(count) && count >= (second === 0 ? 0 : curve[second - 1]),
      )
    return { score, curve: validCurve ? curve : undefined }
  } catch {
    // 読み取れない記録は次回のプレイで保存し直す。
  }
}

export function readPersonalBestCurve(mode: PlayMode): number[] | undefined {
  if (mode.duration === 'survival') return
  try {
    return readPersonalBest(personalBestKey(mode), mode.duration)?.curve
  } catch {
    // ストレージへのアクセスが無効でもプレイできるようにする。
  }
}

export function savePersonalBest(
  mode: PlayMode,
  score: number,
  curve?: number[],
): { best: number; isNewRecord: boolean; pointsToBest: number | null } {
  const key = personalBestKey(mode)
  let best = score

  try {
    const saved = readPersonalBest(key, mode.duration)
    if (saved) {
      best = saved.score
      if (score <= best) {
        if (score === best && curve && !saved.curve) {
          window.localStorage.setItem(key, JSON.stringify({ score, curve }))
        }
        return { best, isNewRecord: false, pointsToBest: best - score }
      }
    }

    window.localStorage.setItem(key, curve ? JSON.stringify({ score, curve }) : String(score))
    return { best: score, isNewRecord: true, pointsToBest: null }
  } catch {
    // 保存が無効な環境でも結果画面に進めるようにする。
    return { best, isNewRecord: false, pointsToBest: null }
  }
}
