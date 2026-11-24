import { useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useEffectTimeline } from '../lib/useEffectTimeline'
import { BATTLE_FEEDBACK } from '../lib/battleUi'
import './BattleStage.css'

export type BattleMotion = { cue: 'hit'; trigger: number }

type BattleStageProps = {
  className?: string
  style?: CSSProperties
  rearEffects?: ReactNode
  characters: ReactNode
  foreground?: ReactNode
  motion?: BattleMotion
  lowPower?: boolean
}

export function BattleStage({
  className, style, rearEffects, characters, foreground, motion, lowPower = false,
}: BattleStageProps) {
  const camera = useRef<HTMLDivElement>(null)
  useEffectTimeline({
    scope: camera,
    active: motion !== undefined,
    trigger: motion ? `${motion.cue}:${motion.trigger}` : 0,
    lowPower,
  }, (timeline, target) => {
    if (!motion) return
    const { offsets, durationSeconds, zoom } = BATTLE_FEEDBACK[motion.cue]
    timeline.to(target, {
      keyframes: { x: offsets, scale: [1, zoom, 1], easeEach: 'none' },
      duration: durationSeconds,
      ease: 'none',
    })
  })

  return (
    <div className="battle-stage-space">
      <div className={`battle-stage ${className ?? ''}`} style={style}>
        <div className="battle-camera" ref={camera}>
          <div className="attack-framing">
            <div className="battle-layer battle-distance" aria-hidden="true" />
            <div className="battle-layer battle-ground" aria-hidden="true" />
            <div className="battle-layer battle-rear-effects">{rearEffects}</div>
            <div className="battle-layer battle-characters">{characters}</div>
            <div className="battle-layer battle-front-effects">{foreground}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
