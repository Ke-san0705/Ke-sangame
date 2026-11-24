import type { CSSProperties, ReactNode } from 'react'
import { preload } from 'react-dom'
import { CHARGE_COLORS } from '../lib/huntConfig'
import type { Enemy } from '../lib/enemyApproach'
import { EnemyApproach } from './EnemyApproach'
import { BattleStage, type BattleMotion } from './BattleStage'
import { AttackEffect } from './AttackEffects'
import type { AttackVisual } from '../lib/attackEffects'
import { useReducedEffects } from '../lib/useEffectTimeline'
import './ChargeArena.css'

const spriteNames = ['slime', 'mushroom', 'tiger-cub', 'baby-dragon', 'goblin', 'wolf', 'treant', 'wood-golem',
  'skeleton', 'dark-mage', 'gargoyle', 'death-knight', 'hellhound', 'reaper', 'dragon', 'demon-king']
const sprites = spriteNames.map((name) => `${import.meta.env.BASE_URL}monsters/${name}.png`)
const initialMonsters = 6
const maxMonsters = 66
const goldenAngle = Math.PI * (3 - Math.sqrt(5))

export function preloadChargeSprites() {
  for (const src of sprites) preload(src, { as: 'image' })
}

export function ChargeArena({ correctCount, battle }: {
  correctCount: number
  battle?: { lowPower: boolean; foreground: ReactNode; enemies: readonly Enemy[]; attacks: readonly AttackVisual[]; onAttackComplete: (id: number, replace: boolean) => void; stage: number; motion?: BattleMotion }
}) {
  const reduced = useReducedEffects()
  const color = CHARGE_COLORS.find(({ fromCorrect }) => correctCount >= fromCorrect)?.color ?? 'blue'
  if (battle) {
    const simple = reduced || battle.lowPower
    const attacks = simple ? battle.attacks.slice(-1) : battle.attacks
    return (
      <BattleStage className="charge-arena"
        characters={<EnemyApproach enemies={battle.enemies} attackId={correctCount} stage={battle.stage}
          lowPower={simple} attacks={reduced ? undefined : attacks} />}
        foreground={
          <>
            {attacks.map((attack) => (
              <AttackEffect key={attack.id} attack={attack} simple={simple} onComplete={battle.onAttackComplete} />
            ))}
            {battle.foreground}
          </>
        }
        motion={battle.motion} lowPower={simple} />
    )
  }

  const compression = correctCount / (correctCount + 10)
  const monsterCount = Math.min(maxMonsters, initialMonsters + correctCount)
  const swarmWidth = 92 - 50 * compression
  const swarmHeight = 46 - 22 * compression
  const arenaStyle = {
    '--charge-scale': 0.58 + 1.5 * compression,
    '--swarm-width': `${swarmWidth}%`,
    '--swarm-height': `${swarmHeight}%`,
  } as CSSProperties

  const swarm = (
    <div className="charge-swarm" aria-hidden="true">
      {Array.from({ length: monsterCount }, (_, index) => {
        const angle = index * goldenAngle
        const radius = Math.sqrt((index + 0.5) / monsterCount) * 48
        const horizontal = Math.cos(angle) * radius
        const depth = Math.sin(angle) * radius
        return (
          <img
            key={index}
            src={sprites[index % sprites.length]}
            alt=""
            decoding="async"
            style={{
              '--release-flight-x': `${Math.cos(angle) * 43}vw`,
              '--release-flight-y': `${-80 - Math.abs(Math.sin(angle)) * 24}dvh`,
              '--release-start-x': `${horizontal * swarmWidth / 100}vw`,
              '--release-start-y': `${depth * swarmHeight / 100}dvh`,
              left: `${50 + horizontal}%`,
              top: `${50 + depth}%`,
              zIndex: Math.round(50 + depth),
            } as CSSProperties}
          />
        )
      })}
    </div>
  )
  const barrier = <div className="charge-barrier" aria-hidden="true" />
  const cannon = (
    <div className="charge-cannon" aria-hidden="true">
      <svg viewBox="0 0 200 150" focusable="false">
        <path className="charge-cannon-mount" d="M67 90h66l20 53H47z" />
        <path className="charge-cannon-body" d="M57 57h86l-10 56-18 17H85l-18-17z" />
        <path className="charge-cannon-rail" d="m67 65 10 42 12 12m44-54-10 42-12 12" />
        <ellipse className="charge-cannon-rim" cx="100" cy="60" rx="63" ry="34" />
        <ellipse className="charge-cannon-field" cx="100" cy="57" rx="53" ry="26" />
        <ellipse className="charge-cannon-core" cx="100" cy="56" rx="38" ry="17" />
        <path className="charge-cannon-rail" d="M91 84h18m-9 10v22" />
      </svg>
    </div>
  )


  return (
    <div className="charge-arena" data-color={color} style={arenaStyle} aria-hidden="true">
      {swarm}
      {barrier}
      {cannon}
    </div>
  )
}
