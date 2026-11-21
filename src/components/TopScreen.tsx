import { durations, levels, operations, type GameMode } from '../lib/gameMode'

type TopScreenProps = {
  mode: GameMode
  onModeChange: (mode: GameMode) => void
  onStart: () => void
  onRanking: () => void
}

const operationKeys = Object.keys(operations) as GameMode['operation'][]
const levelKeys = Object.keys(levels).map(Number) as GameMode['level'][]

export function TopScreen({ mode, onModeChange, onStart, onRanking }: TopScreenProps) {
  return (
    <main className="top-screen">
      <header className="top-header">
        <button type="button" className="ranking-button" onClick={onRanking}>ランキング</button>
        <h1>計算無双</h1>
      </header>

      <div className="operation-options" role="group" aria-label="演算">
        {operationKeys.map((operation) => (
          <button
            key={operation}
            type="button"
            className={operation === 'mix' ? 'mix-option' : undefined}
            aria-label={operations[operation].label}
            aria-pressed={mode.operation === operation}
            onClick={() => onModeChange({ ...mode, operation })}
          >
            {operations[operation].symbol}
          </button>
        ))}
      </div>

      <div className="level-options" role="group" aria-label="レベル">
        {levelKeys.map((level) => (
          <button
            key={level}
            type="button"
            aria-pressed={mode.level === level}
            onClick={() => onModeChange({ ...mode, level })}
          >
            Lv.{level}{'\u3000'}{levels[level]}
          </button>
        ))}
      </div>

      <div className="duration-options" role="group" aria-label="制限時間">
        {durations.map((duration) => (
          <button
            key={duration}
            type="button"
            aria-pressed={mode.duration === duration}
            onClick={() => onModeChange({ ...mode, duration })}
          >
            {duration}秒
          </button>
        ))}
      </div>

      <button type="button" className="start-button" onClick={onStart}>START</button>
    </main>
  )
}
