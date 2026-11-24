import { useSyncExternalStore, type RefObject } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

gsap.registerPlugin(useGSAP)

const motionQueries = ['(prefers-reduced-motion: reduce)', '(update: slow)']
const supportsMotionQueries = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
const readReducedEffects = () =>
  !supportsMotionQueries() || motionQueries.some((query) => window.matchMedia(query).matches)
const readServerSnapshot = () => true

function subscribeToMotion(onChange: () => void) {
  const preferences = supportsMotionQueries() ? motionQueries.map((query) => window.matchMedia(query)) : []
  preferences.forEach((preference) => preference.addEventListener('change', onChange))
  return () => {
    preferences.forEach((preference) => preference.removeEventListener('change', onChange))
  }
}

type EffectTimelineOptions = {
  scope: RefObject<HTMLElement | null>
  active: boolean
  trigger: number | string
  lowPower: boolean
}

// The owning screen controls when the effect runs. Timeline callbacks must stay visual.
export function useEffectTimeline(
  { scope, active, trigger, lowPower }: EffectTimelineOptions,
  setup: (timeline: gsap.core.Timeline, target: HTMLElement) => void,
) {
  const reducedEffects = useSyncExternalStore(subscribeToMotion, readReducedEffects, readServerSnapshot)
  const enabled = active && !lowPower && !reducedEffects

  useGSAP(() => {
    const target = scope.current
    if (enabled && target) setup(gsap.timeline(), target)
  }, { scope, dependencies: [enabled, trigger], revertOnUpdate: true })
}
