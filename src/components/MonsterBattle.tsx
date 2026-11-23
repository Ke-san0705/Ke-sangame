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
const spriteUrl = (sprite: string) => `${import.meta.env.BASE_URL}monsters/${sprite}.png`
const heroUrl = spriteUrl('hero')

function encounter(defeated: number) {
  const previousBosses = Math.floor(defeated / bossInterval)
  const boss = (defeated + 1) % bossInterval === 0
  const [sprite, name] = boss
    ? bosses[previousBosses % bosses.length]
    : monsters[(defeated - previousBosses) % monsters.length]
  return { src: spriteUrl(sprite), name, boss }
}

export function preloadBattleSprites(defeated: number) {
  if (defeated === 0) {
    preload(heroUrl, { as: 'image' })
    preload(encounter(0).src, { as: 'image' })
    preload(encounter(1).src, { as: 'image', fetchPriority: 'low' })
  }
  // Keep the next two opponents within reach without loading the full roster at start.
  preload(encounter(defeated + 2).src, { as: 'image', fetchPriority: 'low' })
}

export function MonsterBattle({ defeated, combo }: { defeated: number; combo: number }) {
  const current = encounter(defeated)
  const previous = defeated > 0 ? encounter(defeated - 1) : undefined

  return (
    <div className="monster-battle">
      <img className="monster-sprite" src={heroUrl} alt="勇者" decoding="async" />
      <div className="monster-battle-status">
        <span>{defeated}体討伐</span>
        {current.boss && <span className="monster-boss-label" aria-hidden="true">ボス戦</span>}
      </div>
      <div className="monster-battle-target" key={defeated}>
        <img
          className={previous ? 'monster-sprite monster-arriving' : 'monster-sprite'}
          data-boss={current.boss}
          src={current.src}
          alt={`${current.boss ? 'ボス' : 'モンスター'}：${current.name}`}
          decoding="async"
        />
        {previous && (
          <img
            className="monster-sprite monster-defeated"
            data-boss={previous.boss}
            data-combo={combo >= 5}
            src={previous.src}
            alt=""
            aria-hidden="true"
            decoding="async"
          />
        )}
      </div>
    </div>
  )
}
