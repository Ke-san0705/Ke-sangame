import type { GameMode } from './gameMode'

export type RankingEntry = { id: number; nickname: string; score: number }

export class RankingError extends Error {}

const deviceKey = 'ke-sangame:ranking-device'
// Keep this list in sync with the seed values in ranking_blocked_words.
const blockedWords = ['死ね', 'しね', '殺す', 'ころす', 'バカ', 'ばか', 'fuck', 'shit']

export function nicknameError(nickname: string): string | null {
  const length = [...nickname].length
  if (length < 1 || length > 10) return 'ニックネームは1〜10文字で入力してください。'
  const normalized = nickname.normalize('NFKC').toLowerCase()
  if (/\p{Cc}/u.test(nickname) ||
      blockedWords.some((word) => normalized.includes(word))) {
    return '使用できない文字や言葉が含まれています。'
  }
  return null
}

function rankingConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '')
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  return url && key ? { url, key } : null
}

export function rankingConfigured(): boolean {
  return rankingConfig() !== null
}

const categoryParams = (mode: GameMode) => ({
  p_operation: mode.operation,
  p_level: mode.level,
  p_duration_seconds: mode.duration,
})

async function rankingRpc(
  name: 'submit_ranking_score' | 'get_rankings',
  params: Record<string, string | number>,
  signal?: AbortSignal,
): Promise<RankingEntry[]> {
  const config = rankingConfig()
  if (!config || !navigator.onLine) throw new RankingError('ランキングに接続できません。')

  const timeout = AbortSignal.timeout(10_000)
  const response = await fetch(`${config.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  })
  if (response.status === 429) throw new RankingError('前回の登録から30秒経ってからお試しください。')
  if (!response.ok) throw new RankingError('ランキングに接続できないか、入力を受け付けられませんでした。')
  const entries: RankingEntry[] = await response.json()
  if (!Array.isArray(entries)) throw new RankingError('ランキングの応答を読み取れませんでした。')
  return entries
}

export function getRankings(mode: GameMode, signal: AbortSignal) {
  return rankingRpc('get_rankings', categoryParams(mode), signal)
}

export async function submitRanking(mode: GameMode, nickname: string, correctCount: number, missCount: number) {
  let deviceId = localStorage.getItem(deviceKey)
  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem(deviceKey, deviceId)
  }
  const entries = await rankingRpc('submit_ranking_score', {
    ...categoryParams(mode),
    p_nickname: nickname,
    p_correct_count: correctCount,
    p_miss_count: missCount,
    p_device_id: deviceId,
  })
  if (!entries.length) throw new RankingError('登録結果を確認できませんでした。')
}
