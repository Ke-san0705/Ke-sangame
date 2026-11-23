import { preload } from 'react-dom'
import type { Level } from '../lib/question-generator'
import './MonsterBattle.css'

const monsters = [
  ['slime', 'スライム'],
  ['mushroom', 'キノコ'],
  ['tiger-cub', '子トラ'],
  ['goblin', 'ゴブリン'],
  ['wolf', 'ウルフ'],
  ['treant', 'トレント'],
  ['skeleton', 'スケルトン'],
  ['dark-mage', '闇の魔術師'],
  ['gargoyle', 'ガーゴイル'],
  ['hellhound', 'ヘルハウンド'],
  ['reaper', '死神'],
  ['dragon', 'ドラゴン'],
] as const

const bosses = [
  ['baby-dragon', 'ベビードラゴン'],
  ['wood-golem', 'ウッドゴーレム'],
  ['death-knight', 'デスナイト'],
  ['demon-king', '魔王'],
] as const

const bossRules = {
  1: { interval: 10, maxHp: 3 },
  2: { interval: 10, maxHp: 3 },
  3: { interval: 8, maxHp: 4 },
  4: { interval: 5, maxHp: 5 },
  5: { interval: 5, maxHp: 5 },
} satisfies Record<Level, { interval: number; maxHp: number }>
const spriteUrl = (sprite: string) => `${import.meta.env.BASE_URL}monsters/${sprite}.png`
const heroUrl = spriteUrl('hero')

function encounter(level: Level, slot: number, gold = false) {
  const { interval: bossInterval } = bossRules[level]
  const previousBosses = Math.floor(slot / bossInterval)
  const boss = !gold && (slot + 1) % bossInterval === 0
  const [sprite, name] = gold
    ? ['slime', '金のスライム']
    : boss
      ? bosses[previousBosses % bosses.length]
      : monsters[(slot - previousBosses) % monsters.length]
  return { src: spriteUrl(sprite), name, boss, gold }
}

type BattleFeedback = 'hit' | 'critical' | 'counter' | 'block' | 'pass' | 'gold' | 'overkill'

export type BattleState = {
  level: Level
  slot: number
  gold: boolean
  goldPending: boolean
  bossHp: number
  defeatedCount: number
  critical?: boolean
  damage: number
  comboMilestone?: number
  action: number
  feedback?: BattleFeedback
  departing?: ReturnType<typeof encounter>
}

export function createBattle(level: Level): BattleState {
  return {
    level, slot: 0, gold: false, goldPending: false, bossHp: bossRules[level].maxHp, defeatedCount: 0, damage: 0, action: 0,
  }
}

export function resolveBattle(
  battle: BattleState, outcome: 'correct' | 'miss' | 'pass', combo: number, critical = false, rush = false,
): BattleState {
  const current = encounter(battle.level, battle.slot, battle.gold)
  const correct = outcome === 'correct'
  const bossBonus = current.boss && rush ? 1 : 0
  const damage = correct ? (critical ? 2 : 1) + bossBonus : 0
  const bossHp = battle.bossHp - damage
  const goldPending = battle.goldPending || combo === 10
  const feedback: BattleFeedback = correct
    ? (critical ? 'critical' : 'hit')
    : outcome === 'pass' ? 'pass' : current.boss ? 'block' : 'counter'
  const comboMilestone = correct && combo > 0 && combo % 5 === 0 ? combo : undefined
  const next = {
    ...battle, damage, comboMilestone, critical, action: battle.action + 1, departing: undefined, feedback,
  }

  if (current.boss && bossHp > 0) return { ...next, bossHp, goldPending }

  return {
    ...next,
    slot: battle.slot + (current.gold ? 0 : 1),
    gold: goldPending,
    goldPending: false,
    bossHp: bossRules[battle.level].maxHp,
    defeatedCount: battle.defeatedCount + (correct ? (current.gold ? 3 : 1) : 0),
    departing: current,
    feedback: correct && current.gold ? 'gold'
      : current.boss && critical ? 'overkill'
      : feedback,
  }
}

export function preloadBattleSprites(level: Level, slot: number) {
  if (slot === 0) {
    preload(heroUrl, { as: 'image' })
    preload(encounter(level, 0).src, { as: 'image' })
    preload(encounter(level, 1).src, { as: 'image', fetchPriority: 'low' })
  }
  preload(encounter(level, slot + 2).src, { as: 'image', fetchPriority: 'low' })
}

export function MonsterBattle({ battle, combo }: {
  battle: BattleState
  combo: number
}) {
  const { level, slot, gold, action, bossHp, defeatedCount, departing, feedback, critical, damage, comboMilestone } = battle
  const { maxHp } = bossRules[level]
  const current = encounter(level, slot, gold)
  const bossDefeated = departing?.boss === true
  const counter = feedback === 'counter' || feedback === 'block'
  const heroMotion = counter ? ' monster-countered' : damage > 0 ? ' monster-attacking' : ''
  const effect = feedback === 'block' ? 'BLOCK!'
    : feedback === 'gold' ? '金のスライム討伐 +3'
    : feedback === 'overkill' ? 'オーバーキル！'
    : undefined

  return (
    <div className="monster-battle">
      <img
        key={heroMotion ? action : 'hero'}
        className={`monster-sprite${heroMotion}`}
        src={heroUrl}
        alt="勇者"
        decoding="async"
      />
      <div className="monster-battle-status">
        <span>{defeatedCount}体討伐</span>
        {current.boss && (
          <>
            <span className="monster-boss-label">ボス戦 · HP {bossHp} / {maxHp}</span>
            <div
              className="monster-boss-hp"
              role="progressbar"
              aria-label="ボスのHP"
              aria-valuemin={0}
              aria-valuemax={maxHp}
              aria-valuenow={bossHp}
            >
              <span style={{ inlineSize: `${100 * bossHp / maxHp}%` }} />
            </div>
          </>
        )}
      </div>
      <div className="monster-battle-target" key={`${slot}:${gold}`}>
        <img
          className={current.boss ? 'monster-sprite monster-boss-arriving'
            : departing ? 'monster-sprite monster-arriving' : 'monster-sprite'}
          data-boss={current.boss}
          data-gold={current.gold}
          src={current.src}
          alt={`${current.boss ? 'ボス' : 'モンスター'}：${current.name}`}
          decoding="async"
        />
        {departing && (
          <img
            className="monster-sprite monster-defeated"
            data-boss={departing.boss}
            data-gold={departing.gold}
            data-combo={combo >= 5}
            data-effect={feedback}
            src={departing.src}
            alt=""
            aria-hidden="true"
            decoding="async"
          />
        )}
        {damage > 0 && (
          <div key={`attack-${action}`} className="monster-impact" aria-hidden="true">
            <span className="monster-slash" />
            <strong className="monster-damage">−{damage}</strong>
          </div>
        )}
      </div>
      <div className="monster-combo-announcement" role="status">
        {comboMilestone !== undefined && (
          <strong key={action} className="monster-combo">{comboMilestone}コンボ！</strong>
        )}
      </div>
      <div className="monster-boss-announcement" role="status">
        {current.boss && <div key={slot} className="monster-boss-banner">ボス戦！</div>}
        {bossDefeated && (
          <div key={action} className="monster-boss-banner monster-boss-victory">
            ボス撃破！
            <strong>累計 {defeatedCount}体討伐</strong>
            {feedback === 'overkill' && (
              <div className="monster-boss-finisher">
                <span>かいしん！</span>
                <span>{effect}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="monster-battle-feedback" role="status">
        {!bossDefeated && (critical || effect) && (
          <div key={action} className="monster-feedback-message" data-effect={feedback}>
            {critical && <span>かいしん！</span>}
            {effect && <span>{effect}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
