import { useRef, type CSSProperties } from 'react'
import samuraiJson from '../../public/assets/initial/characters/samurai.json?raw'
import { useEffectTimeline } from '../lib/useEffectTimeline'
import { loadSpriteAnimation, resolveSpriteClip } from '../lib/spriteAnimation'
import { ATTACK_EFFECTS, attackEffectForStage } from '../lib/attackEffects'
import { ENEMY_STAGE, ENEMY_TYPES } from '../lib/enemyApproachConfig'
import type { Enemy } from '../lib/enemyApproach'

const sprite = (name: string) => `${import.meta.env.BASE_URL}monsters/${name}.png`
const sheet = loadSpriteAnimation(samuraiJson)
const idle = resolveSpriteClip(sheet, 'idle', 'attack')
const framePosition = (frame: number) => {
  const { columns, rows } = sheet.grid
  const column = frame % columns
  const row = Math.floor(frame / columns)
  return `${column * 100 / Math.max(1, columns - 1)}% ${row * 100 / Math.max(1, rows - 1)}%`
}
const idlePosition = framePosition(idle?.startFrame ?? 0)

export function EnemyApproach({ enemies, attackId, stage, lowPower }: {
  enemies: readonly Enemy[]
  attackId: number
  stage: number
  lowPower: boolean
}) {
  const hero = useRef<HTMLDivElement>(null)
  const { windup, shortDuration, hero: pose } = ATTACK_EFFECTS
  useEffectTimeline({ scope: hero, active: attackId > 0, trigger: attackId, lowPower }, (timeline, target) => {
    const shape = attackEffectForStage(stage).shape
    const key = shape === 'slash' || shape === 'flying' ? 'attack' : 'heavyAttack'
    const clip = resolveSpriteClip(sheet, key, 'attack')
    const cell = target.firstElementChild
    if (clip && cell) {
      const count = clip.endFrame - clip.startFrame + 1
      const cycle = windup * 2 + shortDuration
      const interval = Math.min(1 / clip.fps, cycle / count)
      for (let index = 0; index < count; index++) {
        timeline.set(cell, { backgroundPosition: framePosition(clip.startFrame + index) }, index * interval)
      }
      timeline.set(cell, { backgroundPosition: idlePosition }, count * interval)
    }
    timeline.to(target, { x: pose.windupX, rotation: -pose.angle, duration: windup }, 0)
      .to(target, { x: pose.strikeX, rotation: pose.angle, duration: windup }, windup)
      .to(target, { x: 0, rotation: 0, duration: shortDuration, ease: 'power2.out' }, windup * 2)
  })

  return (
    <div className="enemy-approach" aria-hidden="true">
      <div ref={hero} className="battle-hero" style={{ left: `${ENEMY_STAGE.heroX * 100}%` }}>
        <div className="battle-hero-cell" style={{
          backgroundImage: `url("${import.meta.env.BASE_URL}assets/initial/characters/${sheet.image}")`,
          backgroundSize: `${sheet.grid.columns * 100}% ${sheet.grid.rows * 100}%`,
          backgroundPosition: idlePosition,
          '--hero-anchor-x': `${(idle?.anchor.x ?? sheet.cell.width / 2) * 100 / sheet.cell.width}%`,
          '--hero-anchor-y': `${(idle?.anchor.y ?? sheet.cell.height) * 100 / sheet.cell.height}%`,
        } as CSSProperties} />
      </div>
      {enemies.map((enemy) => (
        <img key={enemy.id} className="battle-enemy" data-enemy={enemy.type}
          src={sprite(ENEMY_TYPES[enemy.type].sprite)} alt="" style={{ left: `${enemy.x * 100}%` }} />
      ))}
    </div>
  )
}
