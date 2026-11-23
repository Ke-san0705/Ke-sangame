import type { CSSProperties } from 'react'
import { preload } from 'react-dom'
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

export function ChargeArena({ correctCount }: { correctCount: number }) {
  const color = correctCount >= 15 ? 'black' : correctCount >= 9 ? 'red' : correctCount >= 4 ? 'yellow' : 'blue'
  const compression = correctCount / (correctCount + 10)
  const monsterCount = Math.min(maxMonsters, initialMonsters + correctCount)
  const arenaStyle = {
    '--charge-scale': 0.58 + 1.5 * compression,
    '--swarm-width': `${92 - 50 * compression}%`,
    '--swarm-height': `${46 - 22 * compression}%`,
  } as CSSProperties

  return (
    <div className="charge-arena" data-color={color} style={arenaStyle} aria-hidden="true">
      <div className="charge-swarm">
        {Array.from({ length: monsterCount }, (_, index) => {
          const angle = index * goldenAngle
          const radius = Math.sqrt((index + 0.5) / monsterCount) * 48
          const depth = Math.sin(angle) * radius
          return (
            <img
              key={index}
              src={sprites[index % sprites.length]}
              alt=""
              decoding="async"
              style={{
                left: `${50 + Math.cos(angle) * radius}%`,
                top: `${50 + depth}%`,
                zIndex: Math.round(50 + depth),
              }}
            />
          )
        })}
      </div>
      <div className="charge-barrier" />
      <div className="charge-cannon">
        {correctCount > 0 && <span key={correctCount} className="charge-shockwave" />}
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
    </div>
  )
}
