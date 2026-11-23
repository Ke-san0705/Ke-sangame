import type { GameResult } from './GameScreen'
import { getRankTitle } from '../lib/score'
import type { GameMode, PlayMode } from '../lib/gameMode'
import { rankingConfigured } from '../lib/ranking'
import { RankingRegistration } from './RankingRegistration'
import './ResultScreen.css'

type ResultScreenProps = {
  result: GameResult
  isNewRecord: boolean
  mode: PlayMode
  best: number
  playedOnline: boolean
  online: boolean
  onViewRanking: (mode: GameMode) => void
  onReplay: () => void
  onBack: () => void
}

export function ResultScreen({ result, best, isNewRecord, mode, playedOnline, online, onViewRanking, onReplay, onBack }: ResultScreenProps) {
  const {
    correctCount, missCount, accuracy, score, averageAnswerSeconds, reviewQuestions,
    basePoints, accuracyCoefficient, comboCoefficient, maxCombo,
  } = result

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
        {mode.duration === 'survival' && (
          <div>
            <dt>自己ベスト</dt>
            <dd>{best} 問</dd>
          </div>
        )}
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
        <div>
          <dt>基本点</dt>
          <dd>{basePoints} pt/問</dd>
        </div>
        <div>
          <dt>正確率係数</dt>
          <dd>×{accuracyCoefficient.toFixed(1)}</dd>
        </div>
        <div>
          <dt>コンボ係数</dt>
          <dd>×{comboCoefficient.toFixed(1)}</dd>
        </div>
        <div>
          <dt>最大コンボ</dt>
          <dd>{maxCombo} 連続</dd>
        </div>
      </dl>
      <section className="result-review" aria-labelledby="result-review-heading">
        <h2 id="result-review-heading">復習リスト</h2>
        {reviewQuestions.length === 0 ? (
          <p>復習する問題はありません。</p>
        ) : (
          <ul>
            {reviewQuestions.map(({ expression, answer }, index) => (
              <li key={index}>{expression} = <strong>{answer.replace('-', '−')}</strong></li>
            ))}
          </ul>
        )}
      </section>
      {mode.duration === 'survival' && <p className="result-ranking-status">サバイバルは自己ベストのみ対象です。</p>}
      {mode.duration !== 'survival' && !playedOnline && <p className="result-ranking-status">オフラインでのプレイは自己ベストのみ対象です。</p>}
      {mode.duration !== 'survival' && playedOnline && rankingConfigured() && (
        <RankingRegistration
          mode={mode}
          correctCount={correctCount}
          missCount={missCount}
          maxCombo={maxCombo}
          online={online}
          onViewRanking={() => onViewRanking(mode)}
        />
      )}
      <div className="result-actions">
        <button type="button" className="result-replay" onClick={onReplay}>もう一度遊ぶ</button>
        <button type="button" className="result-back" onClick={onBack}>モード選択に戻る</button>
      </div>
    </main>
  )
}
