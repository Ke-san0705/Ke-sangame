import { memo, useLayoutEffect, useRef, type CSSProperties } from 'react'
import samuraiJson from '../../public/assets/initial/characters/samurai.json?raw'
import { useEffectTimeline } from '../lib/useEffectTimeline'
import { loadSpriteAnimation, resolveSpriteClip, spriteFramePosition } from '../lib/spriteAnimation'
import { ATTACK_EFFECTS, attackEffectForStage, type AttackVisual } from '../lib/attackEffects'
import { ENEMY_STAGE, ENEMY_TYPES, MAX_ENEMY_SPRITES } from '../lib/enemyApproachConfig'
import type { Enemy } from '../lib/enemyApproach'

const sprite = (name: string) => `${import.meta.env.BASE_URL}monsters/${name}.png`
const spriteSlots = Array.from({ length: MAX_ENEMY_SPRITES }, (_, slot) => slot)
const sheet = loadSpriteAnimation(samuraiJson)
const idle = resolveSpriteClip(sheet, 'idle', 'attack')
const idlePosition = spriteFramePosition(sheet, idle?.startFrame ?? 0)

function cancelOnCleanup(animation: Animation | undefined) {
  // Unmounting or replacing a visual can cancel its finished promise.
  void animation?.finished.catch(() => {})
  return () => animation?.cancel()
}

const KnockbackSprites = memo(function KnockbackSprites({ attack }: { attack: AttackVisual }) {
  const scope = useRef<HTMLDivElement>(null)
  const defeated = attack.hits.filter((hit) => hit.defeated)

  useLayoutEffect(() => {
    const layer = scope.current
    const stage = layer?.closest<HTMLElement>('.battle-stage')
    if (!layer || !stage) return
    const { clientWidth: width, clientHeight: height } = stage
    const config = ATTACK_EFFECTS.knockback
    const strength = attack.stage - 1
    const animations = attack.hits.filter((hit) => hit.defeated).map(({ enemy }, index) => {
      const golem = enemy.type === 'golem'
      const profile = golem ? config.golem : config.small
      const distance = width * (config.exitX - enemy.x + strength * config.stageTravel + (golem ? config.golemTravel : 0))
      const lift = height * (profile.lift + strength * config.stageLift)
      // Sample y = -4h·t(1-t) while x advances at constant speed.
      const frames = Array.from({ length: config.samples }, (_, sample) => {
        const t = sample / (config.samples - 1)
        return {
          transform: `translate(${distance * t}px, ${-4 * lift * t * (1 - t)}px) rotate(${profile.rotation * t}deg)`,
          opacity: 1 - t ** 3,
        }
      })
      return cancelOnCleanup(layer.children[index]?.animate?.(frames, { duration: profile.durationMs, fill: 'forwards' }))
    })
    return () => animations.forEach((cancel) => cancel())
  }, [attack])

  if (!defeated.length) return null
  return <div ref={scope}>
    {defeated.map(({ enemy }) => (
      <img key={enemy.id} className="attack-knockback" data-enemy={enemy.type}
        src={sprite(ENEMY_TYPES[enemy.type].sprite)} alt="" style={{ left: `${enemy.x * 100}%` }} />
    ))}
  </div>
})

function EnemySprite({ enemy, flinchId }: { enemy?: Enemy; flinchId?: number }) {
  const image = useRef<HTMLImageElement>(null)
  const enemyId = enemy?.id
  useLayoutEffect(() => {
    if (flinchId === undefined) return
    const { travelPx, rotation, durationMs } = ATTACK_EFFECTS.knockback.flinch
    const animation = image.current?.animate?.([
      { transform: 'none' },
      { transform: `translateX(${travelPx}px) rotate(${rotation}deg)`, offset: 0.3 },
      { transform: 'none' },
    ], durationMs)
    return cancelOnCleanup(animation)
  }, [enemyId, flinchId])

  if (!enemy) return <img ref={image} hidden alt="" />
  return <img ref={image} className="battle-enemy" data-enemy={enemy.type}
    src={sprite(ENEMY_TYPES[enemy.type].sprite)} alt=""
    style={{ translate: `calc(${enemy.x * 100}cqw - 50%)` }} />
}

export function EnemyApproach({ enemies, attackId, stage, lowPower, attacks }: {
  enemies: readonly Enemy[]
  attackId: number
  stage: number
  lowPower: boolean
  attacks?: readonly AttackVisual[]
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
        timeline.set(cell, { backgroundPosition: spriteFramePosition(sheet, clip.startFrame + index) }, index * interval)
      }
      timeline.set(cell, { backgroundPosition: idlePosition }, count * interval)
    }
    timeline.to(target, { x: pose.windupX, rotation: -pose.angle, duration: windup }, 0)
      .to(target, { x: pose.strikeX, rotation: pose.angle, duration: windup }, windup)
      .to(target, { x: 0, rotation: 0, duration: shortDuration, ease: 'power2.out' }, windup * 2)
  })

  const latestAttack = attacks?.at(-1)

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
      {spriteSlots.map((slot) => {
        const enemy = enemies[slot]
        const flinchId = enemy && latestAttack?.hits.some((hit) => !hit.defeated && hit.enemy.id === enemy.id)
          ? latestAttack.id : undefined
        return <EnemySprite key={slot} enemy={enemy} flinchId={flinchId} />
      })}
      {attacks?.map((attack) => <KnockbackSprites key={attack.id} attack={attack} />)}
    </div>
  )
}
