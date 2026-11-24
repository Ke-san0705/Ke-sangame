import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ATTACK_EFFECTS as config, attackEffectForStage, type AttackShape, type AttackVisual } from '../lib/attackEffects'
import { ENEMY_STAGE, ENEMY_TYPES } from '../lib/enemyApproachConfig'

const heroX = ENEMY_STAGE.heroX * config.width
const screenX = (x: number) => Math.min(x * config.width, config.maxScreenX)

function Stroke({ shape, simple }: { shape: AttackShape; simple: boolean }) {
  switch (shape) {
    case 'slash':
      return <>
        <path fill="currentColor" d="M-48 53Q45 2-3-65Q66-11 10 37Z" />
        <path className="attack-core" d="M-48 53Q30 13 17-37Q36 12-48 53Z" />
        {!simple && <path className="attack-sparks" d="m27 25 17-10m-14-37 15-18m-55 84-19 7" />}
      </>
    case 'flying':
      return <>
        {!simple && <path className="attack-trail" d="M-165 46Q-45-46 60-23Q-36-19-165 46ZM-99 47Q-21 3 62-12Q11 15-99 47Z" />}
        <path fill="currentColor" d="M-82 57Q21-33 75-32Q64-1-82 57Z" />
        <path className="attack-core" d="M-53 46Q21-20 68-27Q43-4-53 46Z" />
      </>
    case 'shockwave':
      return <>
        <path className="attack-trail" d="M0 2Q180-112 520 4Q269-50 0 42Z" />
        <path className="attack-sparks" d="M0 10Q222-81 520 4M39 36Q252-12 455 35" />
        {!simple && <>
          <path className="attack-lightning" d="m37 17 68-57 24 25 54-38m27 42 61-50 28 31 62-16m-51 64 70-33 31 22 81-17" />
          <path className="attack-sparks" d="m79-48 4-9m106 84 9 5m200-80 9-8m59 75 16 4" />
        </>}
      </>
    case 'strongShockwave':
      return <>
        <path className="attack-trail" d="M0 28Q145-120 420-83Q490-74 560-26Q323-107 0 28Z" />
        <path className="attack-trail" d="M0 53Q175-50 416-34Q494-27 560 22Q317-54 0 53Z" />
        <path className="attack-sparks" d="M0 28Q283-158 560-26M0 53Q303-102 560 22" />
        {!simple && <path className="attack-lightning" d="m97-34 37-38 20 18 53-47m52 89 39-36 32 15 49-27m44-35 36-40m46 146 41 2" />}
      </>
  }
}

export function AttackEffect({ attack, simple, onComplete }: {
  attack: AttackVisual
  simple: boolean
  onComplete: (id: number, replace: boolean) => void
}) {
  const scope = useRef<SVGSVGElement>(null)
  const profile = attackEffectForStage(attack.stage)
  const { shape, color, travel, duration } = profile
  const slashX = attack.targets[0] ? screenX(attack.targets[0].x) : config.defaultSlashX
  const originX = shape === 'slash' ? slashX : heroX

  useGSAP(() => {
    const target = scope.current
    if (!target) return
    const stroke = target.querySelector('.attack-stroke')
    const impacts = target.querySelectorAll('.attack-impact')
    const timeline = gsap.timeline({ onComplete: () => onComplete(attack.id, simple) })
    const lifetime = simple ? config.shortDuration : duration

    timeline.fromTo(target, { opacity: 1 }, { opacity: 0, duration: lifetime, ease: 'power2.in' })
    if (!simple && stroke) {
      const flying = shape === 'flying'
      timeline.fromTo(stroke, { x: shape === 'slash' ? -travel : 0 }, {
        x: shape === 'slash' ? 0 : travel,
        duration: flying ? config.flyingTravelDuration : lifetime,
        ease: flying ? 'none' : 'power2.out',
      }, 0)
      impacts.forEach((impact, index) => {
        const enemy = attack.targets[index]
        const distance = screenX(enemy.x) - heroX - config.flyingTipX
        const hitTime = flying
          ? Math.max(0, distance / travel) * config.flyingTravelDuration
          : config.windup
        timeline.fromTo(impact, { opacity: 0 }, { opacity: 0.85, duration: config.windup }, hitTime)
        const ghost = impact.querySelector('.attack-knockback')
        if (ghost) {
          const { travel, lift, angle, duration } = config.impact
          timeline.to(ghost, { x: travel, y: lift, rotation: angle, opacity: 0, duration, ease: 'power2.out' }, hitTime)
        }
      })
    }
  }, { scope, dependencies: [simple], revertOnUpdate: true })

  return (
    <svg ref={scope} className="attack-effect" data-attack={shape} data-simple={simple}
      style={{ color }} viewBox={`0 0 ${config.width} ${config.height}`} aria-hidden="true">
      <g transform={`translate(${originX} ${config.baseline})`}>
        <g className="attack-stroke">
          <Stroke shape={shape} simple={simple} />
        </g>
      </g>
      {!simple && attack.targets.map((enemy) => (
        <g key={enemy.id} transform={`translate(${screenX(enemy.x)} ${config.baseline})`}>
          <g className="attack-impact">
            {shape === 'flying' && (
              <image className="attack-knockback" x="-36" y="-78" width="72" height="115"
                href={`${import.meta.env.BASE_URL}monsters/${ENEMY_TYPES[enemy.type].sprite}.png`} />
            )}
            <path className="attack-sparks" d="m-18-19-12-8m43 11 13-11m-10 27 12 8m-46-4-10 9" />
          </g>
        </g>
      ))}
    </svg>
  )
}
