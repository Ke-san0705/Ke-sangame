import type { PlayMode } from './gameMode'

export function savePersonalBest(
  { operation, level, duration }: PlayMode,
  score: number,
): { best: number; isNewRecord: boolean; pointsToBest: number | null } {
  const key = `ke-sangame:personal-best:${operation}:${level}:${duration}`
  let best = score

  try {
    const saved = window.localStorage.getItem(key)
    const savedBest = saved?.trim() ? Number(saved) : NaN
    if (Number.isSafeInteger(savedBest)) {
      best = savedBest
      if (score <= best) return { best, isNewRecord: false, pointsToBest: best - score }
    }

    window.localStorage.setItem(key, String(score))
    return { best: score, isNewRecord: true, pointsToBest: null }
  } catch {
    // 保存が無効な環境でも結果画面に進めるようにする。
    return { best, isNewRecord: false, pointsToBest: null }
  }
}
