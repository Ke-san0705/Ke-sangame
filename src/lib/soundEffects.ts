import { ULTIMATE_AUDIO } from './releaseConfig'

const attackCues = {
  slash: { notes: [980, 570], waveform: 'triangle', spacing: 0.028, duration: 0.06 },
  flying: { notes: [420, 710, 960], waveform: 'sine', spacing: 0.035, duration: 0.09 },
  shockwave: { notes: [155, 88], waveform: 'triangle', spacing: 0.052, duration: 0.13 },
  cannon: { notes: [86, 172, 344], waveform: 'sawtooth', spacing: 0.023, duration: 0.16 },
} as const

const maxAttackVoices = 6

const cues = {
  correct: [660, 880],
  incorrect: [180],
  countdown: [520],
  heartbeat: [62, 48],
  timeUp: [660, 494, 330],
} as const

export type SoundCue = keyof typeof cues | keyof typeof attackCues | keyof typeof ULTIMATE_AUDIO | 'silence'

function correctPitchMultiplier(combo: number) {
  const semitones = combo >= 10 ? 7 : combo >= 5 ? 4 : combo >= 2 ? 2 : 0
  return 2 ** (semitones / 12)
}

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
  const voices = new Set<OscillatorNode>()
  const attackVoices = new Set<OscillatorNode>()

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
    play(cue: SoundCue, combo = 1) {
      if (cue === 'silence') {
        for (const voice of voices) voice.stop()
        return
      }
      if (context?.state !== 'running') return
      const audio = context
      const start = audio.currentTime
      const pitchMultiplier = cue === 'correct' ? correctPitchMultiplier(combo) : 1
      const attack = cue in attackCues ? attackCues[cue as keyof typeof attackCues] : undefined
      const ultimate = cue in ULTIMATE_AUDIO ? ULTIMATE_AUDIO[cue as keyof typeof ULTIMATE_AUDIO] : undefined
      const profile = ultimate ?? attack
      const peak = ultimate ? 0.12 * combo : attack || cue === 'incorrect' ? 0.07 : 0.12
      const notes = profile?.notes ?? cues[cue as keyof typeof cues]
      for (const [index, frequency] of notes.entries()) {
        if (attack && attackVoices.size >= maxAttackVoices) break
        const at = start + index * (profile?.spacing ?? 0.11)
        const duration = profile?.duration ?? (cue === 'timeUp' ? 0.16 : 0.1)
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()
        oscillator.type = profile?.waveform ?? (cue === 'incorrect' ? 'triangle' : 'sine')
        oscillator.frequency.value = frequency * pitchMultiplier
        gain.gain.setValueAtTime(0.001, at)
        gain.gain.exponentialRampToValueAtTime(peak, at + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, at + duration)
        oscillator.connect(gain)
        gain.connect(audio.destination)
        voices.add(oscillator)
        if (attack) attackVoices.add(oscillator)
        oscillator.onended = () => {
          voices.delete(oscillator)
          attackVoices.delete(oscillator)
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
      voices.clear()
      attackVoices.clear()
    },
  }
}
