import type { GameResult } from './GameScreen'
import { getRankProgress } from '../lib/score'
import type { savePersonalBest } from '../lib/personalBest'
import type { GameMode, PlayMode } from '../lib/gameMode'
import { rankingConfigured } from '../lib/ranking'
import { RankingRegistration } from './RankingRegistration'
import './ResultScreen.css'

type ResultScreenProps = {
  result: GameResult
  personalBest: ReturnType<typeof savePersonalBest>
  mode: PlayMode
  playedOnline: boolean
  online: boolean
  onViewRanking: (mode: GameMode) => void
  onReplay: () => void
  onBack: () => void
}

export function ResultScreen({
  result, personalBest, mode, playedOnline, online, onViewRanking, onReplay, onBack,
}: ResultScreenProps) {
  const {
    correctCount, missCount, accuracy, score, averageAnswerSeconds, reviewQuestions,
    maxCombo, charge,
  } = result

  const { best, isNewRecord, pointsToBest } = personalBest
  const { title, pointsToNextRank } = getRankProgress(score)
  const bestGapUnit = mode.duration === 'survival' ? '問' : '点'

  return (
    <main className="result-screen">
      <h1>TIME UP!</h1>
      <div className="result-rank">
        <span>ランク</span>
        <strong>{title}</strong>
      </div>
      <p className="result-score">{score.toLocaleString('ja-JP')} pt</p>
      <div className="result-progress">
        {isNewRecord && <strong className="result-record">NEW RECORD!</strong>}
        {pointsToBest === 0 && <p>自己ベストとタイ記録</p>}
        {pointsToBest !== null && pointsToBest > 0 && (
          <p>自己ベストまであと{pointsToBest.toLocaleString('ja-JP')}{bestGapUnit}</p>
        )}
        <p>{pointsToNextRank === null
          ? '最高の称号に到達！'
          : `次の称号まであと${pointsToNextRank.toLocaleString('ja-JP')}点`}</p>
      </div>
      <button type="button" className="result-replay" onClick={onReplay}>もう1回</button>
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
        {charge && (
          <div>
            <dt>チャージ量</dt>
            <dd>{charge.power.toLocaleString('ja-JP')}</dd>
          </div>
        )}
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
            {reviewQuestions.map(({ expression, answer, outcome, wrongAnswers }, index) => (
              <li key={index}>
                <div className="result-review-labels">
                  {wrongAnswers.length > 0 && <span>ミス</span>}
                  {outcome === 'pass' && <span>パス</span>}
                  {outcome === 'timeout' && <span>時間切れ</span>}
                </div>
                <div>{expression} = <strong>{answer.replace('-', '−')}</strong></div>
                {wrongAnswers.length > 0 && (
                  <div className="result-review-answers">
                    自分の誤答：{wrongAnswers.map((value) => value.replace('-', '−')).join('、')}
                  </div>
                )}
              </li>
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
        <button type="button" className="result-back" onClick={onBack}>モード選択に戻る</button>
      </div>
    </main>
  )
}
