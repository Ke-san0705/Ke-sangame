import type { GameMode } from './gameMode'

export function savePersonalBest({ operation, level, duration }: GameMode, score: number): boolean {
  const key = `ke-sangame:personal-best:${operation}:${level}:${duration}`

  try {
    const saved = window.localStorage.getItem(key)
    const best = saved?.trim() ? Number(saved) : NaN
    if (Number.isSafeInteger(best) && score <= best) return false

    window.localStorage.setItem(key, String(score))
    return true
  } catch {
    // 保存が無効な環境でも結果画面に進めるようにする。
    return false
  }
}
