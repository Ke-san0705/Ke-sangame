import { readSetsunaBest } from '../lib/setsuna'
import { SetsunaRecords } from './SetsunaScreen'
import { DifficultyInfo } from './DifficultyInfo'
import { durations, levels, operations, presentations, type GamePresentation, type PlayMode } from '../lib/gameMode'
import type { ReplayRecords } from '../lib/replayRecords'

type TopScreenProps = {
  mode: PlayMode
  replayRecords: ReplayRecords
  presentation: GamePresentation
  onPresentationChange: (presentation: GamePresentation) => void
  muted: boolean
  onToggleMute: () => void
  onModeChange: (mode: PlayMode) => void
  onStart: () => void
  onRanking: () => void
}

const operationKeys = Object.keys(operations) as PlayMode['operation'][]
const levelKeys = Object.keys(levels).map(Number) as PlayMode['level'][]

const presentationKeys = Object.keys(presentations) as GamePresentation[]

export function TopScreen({
  mode, replayRecords, presentation, onPresentationChange, muted, onToggleMute, onModeChange, onStart, onRanking,
}: TopScreenProps) {
  return (
    <main className="top-screen">
      <header className="top-header">
        <div className="top-controls">
          <button type="button" className="mute-button" aria-pressed={muted} onClick={onToggleMute}>
            ミュート<span aria-hidden="true">{muted ? ' ON' : ' OFF'}</span>
          </button>
          <button type="button" className="ranking-button" onClick={onRanking}>ランキング</button>
        </div>
        <h1>計算無双</h1>
        <div className="presentation-options" role="group" aria-label="ゲームモード">
          {presentationKeys.map((selection) => (
            <button
              key={selection}
              type="button"
              aria-pressed={presentation === selection}
              onClick={() => onPresentationChange(selection)}
            >
              {presentations[selection]}
            </button>
          ))}
        </div>
      </header>

      {presentation === 'setsuna' ? (
        <SetsunaRecords best={readSetsunaBest()} />
      ) : (
        <>
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
            <DifficultyInfo />
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
            <button
              type="button"
              className="survival-option"
              aria-pressed={mode.duration === 'survival'}
              onClick={() => onModeChange({ ...mode, duration: 'survival' })}
            >
              サバイバル
            </button>
          </div>
        </>
      )}

      <button type="button" className="start-button" onClick={onStart}>START</button>
      <p className="top-replay-records">
        <span>{`累計KO数 ${replayRecords.totalKoCount.toLocaleString('ja-JP')}`}</span>
        <span>{`最大飛距離 ${replayRecords.maxDistanceKm.toLocaleString('ja-JP')} km`}</span>
        <span>{`地球爆破 ${replayRecords.earthExplosionCount.toLocaleString('ja-JP')} 回`}</span>
      </p>
    </main>
  )
}
