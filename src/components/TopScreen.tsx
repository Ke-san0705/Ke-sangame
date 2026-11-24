import { readSetsunaBest } from '../lib/setsuna'
import { readStrongEnemy, setsunaRank } from '../lib/setsunaProgress'
import { setsunaDifficulties, setsunaStrongEnemy, type SetsunaDifficulty } from '../lib/setsunaConfig'
import { SetsunaDuelRecord, SetsunaRecords } from './SetsunaScreen'
import { DifficultyInfo } from './DifficultyInfo'
import { durations, levels, operations, presentations, type GamePresentation, type PlayMode } from '../lib/gameMode'
import { SOUND_CONFIG } from '../lib/soundConfig'
import type { ReplayRecords } from '../lib/replayRecords'

type TopScreenProps = {
  mode: PlayMode
  replayRecords: ReplayRecords
  presentation: GamePresentation
  setsunaDifficulty: SetsunaDifficulty
  onSetsunaRematch: () => void
  onSetsunaDifficultyChange: (difficulty: SetsunaDifficulty) => void
  onPresentationChange: (presentation: GamePresentation) => void
  volume: number
  onVolumeChange: (volume: number) => void
  muted: boolean
  onToggleMute: () => void
  onModeChange: (mode: PlayMode) => void
  onStart: () => void
  onRanking: () => void
}

const operationKeys = Object.keys(operations) as PlayMode['operation'][]
const levelKeys = Object.keys(levels).map(Number) as PlayMode['level'][]

const setsunaDifficultyKeys = Object.keys(setsunaDifficulties) as SetsunaDifficulty[]
const presentationKeys = Object.keys(presentations) as GamePresentation[]

export function TopScreen({
  mode, replayRecords, presentation, onPresentationChange, setsunaDifficulty, onSetsunaDifficultyChange,
  volume, onVolumeChange, muted, onToggleMute, onModeChange, onStart, onRanking, onSetsunaRematch,
}: TopScreenProps) {
  const { min, max, step } = SOUND_CONFIG.volumeControl
  const setsuna = presentation === 'setsuna' ? {
    best: readSetsunaBest(setsunaDifficulty),
    strongEnemy: readStrongEnemy(setsunaDifficulty),
  } : null
  const volumePercent = Math.round(volume * max)
  return (
    <main className="top-screen">
      <header className="top-header">
        <div className="top-controls">
          <button type="button" className="mute-button" aria-pressed={muted} onClick={onToggleMute}>
            ミュート<span aria-hidden="true">{muted ? ' ON' : ' OFF'}</span>
          </button>
          <label className="volume-control">
            音量
            <input type="range" min={min} max={max} step={step} value={volumePercent}
              aria-valuetext={`${volumePercent}%`}
              onChange={(event) => onVolumeChange(event.currentTarget.valueAsNumber / max)} />
          </label>
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

      {setsuna ? (
        <section className="setsuna-setup" aria-labelledby="setsuna-difficulty">
          <h2 id="setsuna-difficulty">計算難易度</h2>
          <div className="level-options" role="group" aria-labelledby="setsuna-difficulty">
            {setsunaDifficultyKeys.map((difficulty) => (
              <button
                key={difficulty}
                type="button"
                aria-pressed={setsunaDifficulty === difficulty}
                onClick={() => onSetsunaDifficultyChange(difficulty)}
              >
                {setsunaDifficulties[difficulty].label}
              </button>
            ))}
          </div>
          <SetsunaRecords best={setsuna.best} rank={setsunaRank(setsunaDifficulty, setsuna.best, setsuna.strongEnemy)} />
          <details className="setsuna-rematches">
            <summary>強敵・個別再戦</summary>
            {setsuna.strongEnemy.unlocked ? (
              <div className="setsuna-rematch">
                <button type="button" onClick={onSetsunaRematch}>{setsunaStrongEnemy.label}に再戦</button>
                <SetsunaDuelRecord record={setsuna.strongEnemy.rematch} />
              </div>
            ) : <p>？？？（未遭遇）</p>}
          </details>
        </section>
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
