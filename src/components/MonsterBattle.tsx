import { preload } from 'react-dom'
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

const bossInterval = 10
const bossMaxHp = 3
const spriteUrl = (sprite: string) => `${import.meta.env.BASE_URL}monsters/${sprite}.png`
const heroUrl = spriteUrl('hero')

function encounter(slot: number, gold = false) {
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
  slot: number
  gold: boolean
  goldPending: boolean
  bossHp: number
  defeatedCount: number
  critical?: boolean
  action: number
  feedback?: BattleFeedback
  departing?: ReturnType<typeof encounter>
}

export const initialBattle: BattleState = {
  slot: 0, gold: false, goldPending: false, bossHp: bossMaxHp, defeatedCount: 0, action: 0,
}

export function resolveBattle(
  battle: BattleState, outcome: 'correct' | 'miss' | 'pass', combo: number, critical = false,
): BattleState {
  const current = encounter(battle.slot, battle.gold)
  const correct = outcome === 'correct'
  const damage = correct ? (critical ? 2 : 1) : 0
  const bossHp = battle.bossHp - damage
  const goldPending = battle.goldPending || combo === 10
  const feedback: BattleFeedback = correct
    ? (critical ? 'critical' : 'hit')
    : outcome === 'pass' ? 'pass' : current.boss ? 'block' : 'counter'
  const next = { ...battle, critical, action: battle.action + 1, departing: undefined, feedback }

  if (current.boss && bossHp > 0) return { ...next, bossHp, goldPending }

  return {
    ...next,
    slot: battle.slot + (current.gold ? 0 : 1),
    gold: goldPending,
    goldPending: false,
    bossHp: bossMaxHp,
    defeatedCount: battle.defeatedCount + (correct ? (current.gold ? 3 : 1) : 0),
    departing: current,
    feedback: correct && current.gold ? 'gold'
      : current.boss && critical ? 'overkill'
      : feedback,
  }
}

export function preloadBattleSprites(slot: number) {
  if (slot === 0) {
    preload(heroUrl, { as: 'image' })
    preload(encounter(0).src, { as: 'image' })
    preload(encounter(1).src, { as: 'image', fetchPriority: 'low' })
  }
  preload(encounter(slot + 2).src, { as: 'image', fetchPriority: 'low' })
}

export function MonsterBattle({ battle, combo }: {
  battle: BattleState
  combo: number
}) {
  const { slot, gold, action, bossHp, defeatedCount, departing, feedback, critical } = battle
  const current = encounter(slot, gold)
  const counter = feedback === 'counter' || feedback === 'block'
  const effect = feedback === 'block' ? 'BLOCK!'
    : feedback === 'gold' ? '金のスライム討伐 +3'
    : feedback === 'overkill' ? 'オーバーキル！'
    : undefined

  return (
    <div className="monster-battle">
      <img
        key={counter ? action : 'hero'}
        className={counter ? 'monster-sprite monster-countered' : 'monster-sprite'}
        src={heroUrl}
        alt="勇者"
        decoding="async"
      />
      <div className="monster-battle-status">
        <span>{defeatedCount}体討伐</span>
        {current.boss && <span className="monster-boss-label">ボス戦 · HP {bossHp} / {bossMaxHp}</span>}
      </div>
      <div className="monster-battle-target" key={`${slot}:${gold}`}>
        <img
          className={departing ? 'monster-sprite monster-arriving' : 'monster-sprite'}
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
      </div>
      <div className="monster-battle-feedback" role="status">
        {(critical || effect) && (
          <div key={action} className="monster-feedback-message" data-effect={feedback}>
            {critical && <span>かいしん！</span>}
            {effect && <span>{effect}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
