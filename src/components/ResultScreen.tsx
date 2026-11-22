import type { GameResult } from './GameScreen'
import { getRankTitle } from '../lib/score'
import './ResultScreen.css'

type ResultScreenProps = {
  result: GameResult
  isNewRecord: boolean
  onReplay: () => void
  onBack: () => void
}

export function ResultScreen({ result, isNewRecord, onReplay, onBack }: ResultScreenProps) {
  const { correctCount, missCount, accuracy, score, averageAnswerSeconds } = result

  return (
    <main className="result-screen">
      <h1>TIME UP!</h1>
      <div className="result-rank">
        <span>ランク</span>
        <strong>{getRankTitle(score)}</strong>
      </div>
      <p className="result-score">{score.toLocaleString('ja-JP')} pt</p>
      <div className="result-record">
        {isNewRecord && <strong>NEW RECORD!</strong>}
      </div>
      <dl className="result-stats">
        <div>
          <dt>正解数</dt>
          <dd>{correctCount} 問</dd>
        </div>
        <div>
          <dt>ミス数</dt>
          <dd>{missCount} 回</dd>
        </div>
        <div>
          <dt>正確率</dt>
          <dd>{(accuracy * 100).toFixed(1)} %</dd>
        </div>
        <div>
          <dt>平均回答</dt>
          <dd>{averageAnswerSeconds.toFixed(1)} 秒/問</dd>
        </div>
      </dl>
      <div className="result-actions">
        <button type="button" className="result-replay" onClick={onReplay}>もう一度遊ぶ</button>
        <button type="button" className="result-back" onClick={onBack}>モード選択に戻る</button>
      </div>
    </main>
  )
}
