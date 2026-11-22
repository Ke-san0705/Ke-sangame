const cues = {
  correct: [660, 880],
  incorrect: [180],
  countdown: [520],
  timeUp: [660, 494, 330],
} as const

export type SoundCue = keyof typeof cues

const muteKey = 'ke-sangame:muted'

export function readMuted() {
  try {
    return localStorage.getItem(muteKey) === 'true'
  } catch {
    return false
  }
}

export function saveMuted(muted: boolean) {
  try {
    localStorage.setItem(muteKey, String(muted))
  } catch {
    // The in-session setting still works when storage is unavailable.
  }
}

export function createSoundEffects() {
  let context: AudioContext | undefined

  return {
    unlock() {
      if (typeof AudioContext === 'undefined') return
      try {
        context ??= new AudioContext()
        // Resume during START or replay so timer-driven cues can play.
        if (context.state !== 'running') void context.resume().catch(() => {})
      } catch {
        // Audio availability should not prevent a game from starting.
      }
    },
    play(cue: SoundCue) {
      if (context?.state !== 'running') return
      const audio = context
      const start = audio.currentTime
      for (const [index, frequency] of cues[cue].entries()) {
        const at = start + index * 0.11
        const duration = cue === 'timeUp' ? 0.16 : 0.1
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()
        oscillator.type = cue === 'incorrect' ? 'triangle' : 'sine'
        oscillator.frequency.value = frequency
        gain.gain.setValueAtTime(0.001, at)
        gain.gain.exponentialRampToValueAtTime(0.12, at + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, at + duration)
        oscillator.connect(gain)
        gain.connect(audio.destination)
        oscillator.onended = () => {
          oscillator.disconnect()
          gain.disconnect()
        }
        oscillator.start(at)
        oscillator.stop(at + duration)
      }
    },
    dispose() {
      if (context) void context.close().catch(() => {})
      context = undefined
    },
  }
}
