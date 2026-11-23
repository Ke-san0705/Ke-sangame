import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  calculateRelease, isCriticalRelease, releaseMeterPosition, RELEASE_METER_MS,
} from '../lib/release'
import type { ReleaseResult } from '../lib/release'
import { ChargeArena } from './ChargeArena'
import './ReleaseSequence.css'

const CHARGE_COMPLETE_MS = 450
const HIT_STOP_MS = 200
const AFTERMATH_MS = 1400
const castleImage = `url("${import.meta.env.BASE_URL}stages/demon-castle.jpg")`
const continentImage = `url("${import.meta.env.BASE_URL}stages/grassland.jpg")`

type Phase =
  | { name: 'ready' | 'meter' }
  | { name: 'impact' | 'aftermath'; critical: boolean; release: ReleaseResult }

export function ReleaseSequence({ power, correctCount, onComplete }: {
  power: number
  correctCount: number
  onComplete: (release: ReleaseResult) => void
}) {
  const [phase, setPhase] = useState<Phase>({ name: 'ready' })
  const meterStartedAt = useRef<number | null>(null)
  const needle = useRef<HTMLSpanElement>(null)
  const complete = useEffectEvent(onComplete)

  function fire(critical: boolean) {
    if (meterStartedAt.current === null) return
    meterStartedAt.current = null
    setPhase({ name: 'impact', critical, release: calculateRelease(power, critical) })
  }

  function confirm() {
    const startedAt = meterStartedAt.current
    if (startedAt !== null) fire(isCriticalRelease(performance.now() - startedAt))
  }

  const confirmWithKeyboard = useEffectEvent((event: KeyboardEvent) => {
    if (event.key !== 'Enter' || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return
    event.preventDefault()
    if (!event.repeat) confirm()
  })
  const autoFire = useEffectEvent(() => fire(false))

  useEffect(() => {
    if (phase.name === 'meter') {
      const startedAt = performance.now()
      meterStartedAt.current = startedAt
      let frame: number
      const draw = (now: number) => {
        needle.current?.style.setProperty('left', `${releaseMeterPosition(now - startedAt) * 100}%`)
        frame = window.requestAnimationFrame(draw)
      }
      frame = window.requestAnimationFrame(draw)
      const timeout = window.setTimeout(autoFire, RELEASE_METER_MS)
      const onKeyDown = (event: KeyboardEvent) => confirmWithKeyboard(event)
      window.addEventListener('keydown', onKeyDown)
      return () => {
        meterStartedAt.current = null
        window.cancelAnimationFrame(frame)
        window.clearTimeout(timeout)
        window.removeEventListener('keydown', onKeyDown)
      }
    }

    const timeout = phase.name === 'ready'
      ? window.setTimeout(() => setPhase({ name: 'meter' }), CHARGE_COMPLETE_MS)
      : phase.name === 'impact'
        ? window.setTimeout(() => setPhase({ ...phase, name: 'aftermath' }), HIT_STOP_MS)
        : window.setTimeout(() => {
          if ('release' in phase) complete(phase.release)
        }, AFTERMATH_MS)
    return () => window.clearTimeout(timeout)
  }, [phase])

  const fired = 'release' in phase
  const tier = fired ? phase.release.tier : calculateRelease(power).tier
  const style = { '--release-castle': castleImage, '--release-continent': continentImage } as CSSProperties

  return (
    <main className="release-scene" data-phase={phase.name} data-tier={tier}
      style={style} aria-label="解放">
      <div className="release-world" aria-hidden="true">
        <div className="release-land" />
        <div className="release-orbit">
          <div className="release-planet" />
          <div className="release-moon" />
          <div className="release-constellation" />
        </div>
      </div>
      <ChargeArena correctCount={correctCount} />
      {fired && <div className="release-beam" aria-hidden="true" />}
      <div className="release-hud">
        <div className="release-status" role="status">
          {!fired && <strong>CHARGE COMPLETE</strong>}
          {fired && phase.critical && <strong>CRITICAL RELEASE!</strong>}
          {phase.name === 'aftermath' && 'release' in phase && (
            <>
              <strong className="release-ko">{phase.release.koCount.toLocaleString('ja-JP')} KO</strong>
              {tier === 3 && <span>新星座誕生</span>}
            </>
          )}
        </div>
        {phase.name === 'meter' && (
          <>
            <div className="release-meter" aria-hidden="true">
              <span className="release-meter-target" />
              <span className="release-meter-needle" ref={needle} />
            </div>
            <button className="release-confirm" type="button" onClick={confirm}>決定</button>
          </>
        )}
      </div>
    </main>
  )
}
