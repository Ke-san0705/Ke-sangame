import { useEffect, useState } from 'react'
import { durations, levels, operations, type GameMode } from '../lib/gameMode'
import { getRankings, rankingConfigured, type RankingEntry } from '../lib/ranking'
import './RankingScreen.css'

type RankingState = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; entries: RankingEntry[] }

function RankingList({ mode }: { mode: GameMode }) {
  const [state, setState] = useState<RankingState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    getRankings(mode, controller.signal).then(
      (entries) => {
        if (!controller.signal.aborted) setState({ status: 'loaded', entries })
      },
      () => {
        if (!controller.signal.aborted) setState({ status: 'error' })
      },
    )
    return () => controller.abort()
  }, [mode, attempt])

  if (state.status === 'loading') return <p role="status">読み込み中…</p>
  if (state.status === 'error') {
    return (
      <>
        <p role="alert">ランキングを取得できませんでした。</p>
        <button type="button" onClick={() => {
          setState({ status: 'loading' })
          setAttempt(attempt + 1)
        }}>再読み込み</button>
      </>
    )
  }
  if (!state.entries.length) return <p role="status">この条件の登録はまだありません。</p>

  return (
    <table>
      <caption>上位50件</caption>
      <thead>
        <tr>
          <th scope="col">順位</th>
          <th scope="col">ニックネーム</th>
          <th scope="col">スコア</th>
          <th scope="col">条件</th>
        </tr>
      </thead>
      <tbody>
        {state.entries.map((entry, index) => (
          <tr key={entry.id}>
            <td>{index + 1}</td>
            <th scope="row">{entry.nickname}</th>
            <td>{entry.score.toLocaleString('ja-JP')} pt</td>
            <td>{operations[mode.operation].label} Lv.{mode.level} {mode.duration}秒</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

type Props = { initialMode: GameMode; online: boolean; onBack: () => void }

export function RankingScreen({ initialMode, online, onBack }: Props) {
  const [mode, setMode] = useState(initialMode)
  const configured = rankingConfigured()

  return (
    <main className="secondary-screen ranking-screen">
      <h1>ランキング</h1>
      {configured && (
        <div className="ranking-filters" role="group" aria-label="ランキングの条件">
          <select aria-label="演算" value={mode.operation} onChange={(event) =>
            setMode({ ...mode, operation: event.target.value as GameMode['operation'] })}>
            {Object.entries(operations).map(([value, operation]) => (
              <option key={value} value={value}>{operation.label}</option>
            ))}
          </select>
          <select aria-label="レベル" value={mode.level} onChange={(event) =>
            setMode({ ...mode, level: Number(event.target.value) as GameMode['level'] })}>
            {Object.keys(levels).map((level) => <option key={level} value={level}>Lv.{level}</option>)}
          </select>
          <select aria-label="制限時間" value={mode.duration} onChange={(event) =>
            setMode({ ...mode, duration: Number(event.target.value) as GameMode['duration'] })}>
            {durations.map((duration) => <option key={duration} value={duration}>{duration}秒</option>)}
          </select>
        </div>
      )}
      {!configured && <p role="status">ランキングは利用できません。</p>}
      {configured && !online && <p role="status">オフラインです。</p>}
      {configured && online && <RankingList key={`${mode.operation}:${mode.level}:${mode.duration}`} mode={mode} />}
      <button type="button" className="ranking-back" onClick={onBack}>モード選択に戻る</button>
    </main>
  )
}
