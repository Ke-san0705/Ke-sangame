import { useRef } from 'react'
import { levels } from '../lib/gameMode'
import type { Level } from '../lib/question-generator'
import { basePointsByLevel, missPenalty } from '../lib/score'

const title = 'スコア計算・出題範囲'
const levelKeys = Object.keys(levels).map(Number) as Level[]

// 出題範囲は docs/design/design-v2.md §2.2 のレベル別出題表に準拠。
const questionRanges = {
  1: ['1桁＋1桁〜2桁＋1桁', '2桁−1桁（答えは0以上）', '九九（1桁×1桁）', '九九の逆', 'なし'],
  2: ['3桁＋2桁まで', '3桁−2桁まで', '2桁×1桁、易しい2桁×2桁（相手が10の倍数または11）', '2〜3桁÷1桁', 'やさしい小数の足し算・引き算'],
  3: ['4桁＋3桁まで', '4桁−3桁まで', '2桁×2桁まで', '3桁÷2桁まで（答えが2〜3桁になる範囲を多めに出題）', '負の数の入門、小数'],
  4: ['4桁同士', '4桁同士', '2桁×3桁まで', '4桁÷2桁まで', '小数と負の数の混合、括弧付き計算の入門（最大2項）'],
  5: ['4桁同士、連続演算（最大2項）', '4桁同士、連続演算（最大2項）', '3桁×3桁まで（答えは6桁以内）', '4桁÷3桁まで', '小数と負の数の全混合、括弧付き計算（最大2項）'],
} satisfies Record<Level, [string, string, string, string, string]>

const rangeLabels = ['足し算', '引き算', '掛け算', '割り算', '追加要素']

export function DifficultyInfo() {
  const dialog = useRef<HTMLDialogElement>(null)

  return (
    <>
      <button
        type="button"
        className="difficulty-info-button"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        {title}
      </button>
      <dialog ref={dialog} className="difficulty-info" aria-labelledby="difficulty-info-title">
        <header>
          <h2 id="difficulty-info-title">{title}</h2>
          <button type="button" onClick={() => dialog.current?.close()}>閉じる</button>
        </header>

        <h3>スコア計算</h3>
        <p>正解数 × 基本点 × 正確率係数 × コンボ係数を四捨五入し、ミス減点を引きます。</p>
        <dl>
          <dt>基本点</dt>
          <dd>{levelKeys.map((level) => `Lv.${level} ${basePointsByLevel[level]}点`).join(' ／ ')}</dd>
          <dt>正確率係数</dt>
          <dd>100%は1.2倍、90%以上100%未満は1.1倍、90%未満は1.0倍。</dd>
          <dt>コンボ係数</dt>
          <dd>プレイ中の最大連続正解数で決まります。0〜4問は1.0倍、5問ごとに0.1倍加算し、25問以上は1.5倍です。</dd>
          <dt>ミス減点</dt>
          <dd>不正解・パス1回につき{missPenalty}点減点。正確率は正解数を「正解数＋不正解数＋パス数」で割った割合です。</dd>
        </dl>

        <h3>レベル別の出題範囲</h3>
        <p>割り算はすべて割り切れる問題です。</p>
        {levelKeys.map((level) => (
          <section key={level}>
            <h4>Lv.{level} {levels[level]}</h4>
            <dl>
              {questionRanges[level].map((range, index) => (
                <div key={rangeLabels[index]}>
                  <dt>{rangeLabels[index]}</dt>
                  <dd>{range}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </dialog>
    </>
  )
}
