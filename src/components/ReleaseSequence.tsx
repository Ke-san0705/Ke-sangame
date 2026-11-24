import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from 'react'
import { breaksPlanet, type ReleaseResult } from '../lib/release'
import { RELEASE } from '../lib/releaseConfig'
import type { Enemy } from '../lib/enemyApproach'
import { ENEMY_STAGE } from '../lib/enemyApproachConfig'
import type { SoundCue } from '../lib/soundEffects'
import { useReducedEffects } from '../lib/useEffectTimeline'
import { EnemyApproach } from './EnemyApproach'
import './ReleaseSequence.css'

const castle = `url("${import.meta.env.BASE_URL}stages/demon-castle.jpg")`

export function ReleaseSequence({ release, enemies, lowPower, onSound, onComplete }: {
  release: ReleaseResult
  enemies: readonly Enemy[]
  lowPower: boolean
  onSound?: (cue: SoundCue, volume?: number) => void
  onComplete: () => void
}) {
  const [phaseIndex, setPhaseIndex] = useState(0)
  const completed = useRef(false)
  const phase = RELEASE.timeline[phaseIndex]
  const profile = RELEASE.tiers[release.tier - 1]
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
    let index = 0
    let timeout: number
    playSound('silence')

    function advance() {
      if (completed.current) return
      const elapsed = performance.now() - start
      if (elapsed >= RELEASE.endMs) {
        complete()
        return
      }
      const upcoming = RELEASE.timeline.findIndex(({ at }) => at > elapsed)
      const next = (upcoming === -1 ? RELEASE.timeline.length : upcoming) - 1
      if (next !== index) {
        index = next
        setPhaseIndex(index)
        const cue = RELEASE.timeline[index].cue
        if (cue) playSound(cue)
      }
      const nextAt = RELEASE.timeline[index + 1]?.at ?? RELEASE.endMs
      timeout = window.setTimeout(advance, Math.max(1, Math.ceil(nextAt - elapsed)))
    }

    advance()
    return () => {
      window.clearTimeout(timeout)
      playSound('silence')
    }
  }, [])

  const duration = (RELEASE.timeline[phaseIndex + 1]?.at ?? RELEASE.endMs) - phase.at
  const style = {
    '--release-color': RELEASE.color,
    '--release-castle': castle,
    '--release-hero-x': `${ENEMY_STAGE.heroX * 100}%`,
    '--release-glow': profile.glow,
    '--release-reach': profile.reach,
    '--release-shake': `${profile.shake}px`,
    '--release-phase-ms': `${duration}ms`,
  } as CSSProperties

  const streaks = phase.phase === 'gather' || phase.phase === 'blast'
  const { angleStep, minDistance, distanceStep, distanceVariants, delayStepMs, delayVariants } = RELEASE.particles

  return (
    <main className="release-scene" aria-label="解放" data-phase={phase.phase} data-tier={release.tier}
      data-reduced={reduced} style={style}>
      <div className="release-camera" aria-hidden="true">
        <div className="release-land" />
        {breaksPlanet(release) && <div className="release-planet" />}
        <EnemyApproach enemies={enemies} attackId={0} stage={1} lowPower />
        <div className="release-effects" key={phase.phase}>
          {phase.phase === 'gather' && <div className="release-blade" />}
          {phase.phase === 'slash' && <div className="release-slash" />}
          {phase.phase === 'blast' && (
            <>
              <div className="release-beam" />
              <div className="release-burst" />
              <div className="release-ring" />
            </>
          )}
          {streaks && !reduced && Array.from({ length: profile.sparks }, (_, index) => (
            <i className="release-spark" key={index} style={{
              '--spark-angle': `${index * angleStep}deg`,
              '--spark-distance': `${minDistance + (index % distanceVariants) * distanceStep}vmin`,
              '--spark-delay': `${(index % delayVariants) * delayStepMs}ms`,
            } as CSSProperties} />
          ))}
        </div>
      </div>
      {phase.phase !== 'blackout' && (
        <div className="release-status" role="status">
          <strong>{profile.label}</strong>
          {phase.phase === 'aftermath' && (
            <span className="release-ko">{release.koCount.toLocaleString('ja-JP')} KO</span>
          )}
        </div>
      )}
      <button type="button" className="release-skip" onClick={finish}>スキップ</button>
    </main>
  )
}
