import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from 'react'
import { breaksPlanet, type ReleasePlan } from '../lib/release'
import { RELEASE } from '../lib/releaseConfig'
import { ENEMY_STAGE, ENEMY_TYPES } from '../lib/enemyApproachConfig'
import type { SoundCue } from '../lib/soundEffects'
import { useReducedEffects } from '../lib/useEffectTimeline'
import { EnemyApproach } from './EnemyApproach'
import './ReleaseSequence.css'

const castle = `url("${import.meta.env.BASE_URL}stages/demon-castle.jpg")`

export function ReleaseSequence({ plan, lowPower, onSound, onComplete }: {
  plan: ReleasePlan
  lowPower: boolean
  onSound?: (cue: SoundCue, volume?: number) => void
  onComplete: () => void
}) {
  const { result, waves, startingKo } = plan
  const [beat, setBeat] = useState(0)
  const completed = useRef(false)
  const profile = RELEASE.tiers[result.tier - 1]
  const reduced = useReducedEffects() || lowPower
  const playSound = useEffectEvent((cue: SoundCue) => onSound?.(cue, profile.volume))

  function finish() {
    if (completed.current) return
    completed.current = true
    onComplete()
  }

  const complete = useEffectEvent(finish)

  useEffect(() => {
    const start = performance.now()
    const boundaries = [0, ...waves.map(({ at }) => at), RELEASE.aftermathMs, RELEASE.endMs]
    let index = 0
    let timeout: number
    playSound('ultimateGather')

    function advance() {
      if (completed.current) return
      const elapsed = performance.now() - start
      if (elapsed >= RELEASE.endMs) {
        complete()
        return
      }
      const next = boundaries.findIndex((at) => at > elapsed) - 1
      if (next !== index) {
        index = next
        setBeat(index)
        playSound(index === 1 ? 'ultimateSlash' : index <= waves.length ? 'ultimateBlast' : 'silence')
      }
      timeout = window.setTimeout(advance, Math.max(1, Math.ceil(boundaries[index + 1] - elapsed)))
    }

    advance()
    return () => {
      window.clearTimeout(timeout)
      playSound('silence')
    }
  }, [waves])

  const wave = waves[beat - 1]
  const phase = beat === 0 ? 'gather' : beat === 1 ? 'slash' : wave ? 'blast' : 'aftermath'
  const phaseStart = wave?.at ?? (beat === 0 ? 0 : RELEASE.aftermathMs)
  const phaseEnd = waves[beat]?.at ?? (phase === 'aftermath' ? RELEASE.endMs : RELEASE.aftermathMs)
  const koCount = wave?.koCount ?? (beat === 0 ? startingKo : result.koCount)
  const style = {
    '--release-color': RELEASE.color,
    '--release-castle': castle,
    '--release-hero-x': `${ENEMY_STAGE.heroX * 100}%`,
    '--release-glow': profile.glow,
    '--release-reach': profile.reach,
    '--release-shake': `${profile.shake}px`,
    '--release-phase-ms': `${phaseEnd - phaseStart}ms`,
  } as CSSProperties

  const { angleStep, minDistance, distanceStep, distanceVariants, delayStepMs, delayVariants } = RELEASE.particles

  return (
    <main className="release-scene" aria-label="解放" data-phase={phase} data-tier={result.tier}
      data-reduced={reduced} data-beat={beat % 2} style={style}>
      <div className="release-camera" aria-hidden="true">
        <div className="release-land" />
        {phase !== 'aftermath' && breaksPlanet(result) && <div className="release-planet" data-broken={beat === waves.length} />}
        <EnemyApproach enemies={[]} attackId={wave ? beat : 0} stage={beat === 1 ? 2 : 4} lowPower={reduced} />
        {waves.slice(Math.max(0, beat - 1)).flatMap(({ targets }, index) => {
          const targetBeat = Math.max(0, beat - 1) + index + 1
          return targets.filter(({ reinforcement }) => !reinforcement || targetBeat <= beat + 1)
            .map(({ enemy, reinforcement, lane }) => (
              <img key={enemy.id} className="release-enemy" alt=""
                data-motion={targetBeat === beat ? 'flight' : reinforcement ? 'approach' : 'ready'}
                src={`${import.meta.env.BASE_URL}monsters/${ENEMY_TYPES[enemy.type].sprite}.png`}
                style={{
                  '--enemy-x': `${(reinforcement ? enemy.x : Math.min(enemy.x, 0.96)) * 100}%`,
                  '--enemy-arrival': `${(RELEASE.crowd.startX - enemy.x) * 100}vw`,
                  '--enemy-lane': `${lane * RELEASE.crowd.laneStep}vmin`,
                } as CSSProperties} />
            ))
        })}
        <div className="release-effects" key={beat}>
          {phase === 'gather' && <div className="release-blade" />}
          {phase === 'slash' && <div className="release-slash" />}
          {phase === 'blast' && <div className="release-ring" />}
          {!reduced && wave && Array.from({ length: profile.sparks }, (_, index) => (
            <i className="release-spark" key={index} style={{
              '--spark-angle': `${index * angleStep}deg`,
              '--spark-distance': `${minDistance + (index % distanceVariants) * distanceStep}vmin`,
              '--spark-delay': `${(index % delayVariants) * delayStepMs}ms`,
            } as CSSProperties} />
          ))}
        </div>
      </div>
      <div className="release-status">
        <strong>{profile.label}</strong>
        <span className="release-ko" role="status" aria-live={phase === 'aftermath' ? 'polite' : 'off'}>
          {koCount.toLocaleString('ja-JP')} KO
        </span>
      </div>
      <button type="button" className="release-skip" onClick={finish}>スキップ</button>
    </main>
  )
}
