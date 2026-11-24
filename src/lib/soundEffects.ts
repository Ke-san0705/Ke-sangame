import { ULTIMATE_AUDIO } from './releaseConfig'

import { SOUND_CONFIG, SOUND_CUES } from './soundConfig'

export type SoundCue = keyof typeof SOUND_CUES | keyof typeof ULTIMATE_AUDIO | 'silence'

function comboPitchMultiplier(combo: number) {
  const step = SOUND_CONFIG.comboPitch.find(({ minCombo }) => combo >= minCombo)
  return 2 ** ((step?.semitones ?? 0) / 12)
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

const volumeKey = 'ke-sangame:volume'

function normalizeVolume(volume: number) {
  return Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : SOUND_CONFIG.defaultVolume
}

export function readVolume() {
  try {
    const stored = localStorage.getItem(volumeKey)
    return stored === null ? SOUND_CONFIG.defaultVolume : normalizeVolume(Number(stored))
  } catch {
    return SOUND_CONFIG.defaultVolume
  }
}

export function saveVolume(volume: number) {
  try {
    localStorage.setItem(volumeKey, String(normalizeVolume(volume)))
  } catch {
    // The in-session setting still works when storage is unavailable.
  }
}

export function createSoundEffects(initialVolume: number = SOUND_CONFIG.defaultVolume) {
  let context: AudioContext | undefined
  let output: GainNode | undefined
  let volume = normalizeVolume(initialVolume)
  const voices = new Map<OscillatorNode, () => void>()

  function stopVoices() {
    for (const [voice, cleanup] of voices) {
      voice.stop()
      cleanup()
    }
  }

  return {
    unlock() {
      if (typeof AudioContext === 'undefined') return
      try {
        context ??= new AudioContext()
        if (!output) {
          const gain = context.createGain()
          gain.gain.value = volume
          gain.connect(context.destination)
          output = gain
        }
        // Resume during START or replay so timer-driven cues can play.
        if (context.state !== 'running') void context.resume().catch(() => {})
      } catch {
        // Audio availability should not prevent a game from starting.
      }
    },
    setVolume(value: number) {
      volume = normalizeVolume(value)
      if (output) output.gain.value = volume
      if (volume === 0) stopVoices()
    },
    play(cue: SoundCue, intensity = 1) {
      if (cue === 'silence') {
        stopVoices()
        return
      }
      if (context?.state !== 'running' || !output || volume === 0) return
      const audio = context
      const start = audio.currentTime
      const pitch = cue === 'correct' || cue === 'slash' ? comboPitchMultiplier(intensity) : 1
      const ultimate = ULTIMATE_AUDIO[cue as keyof typeof ULTIMATE_AUDIO]
      const standard = SOUND_CUES[cue as keyof typeof SOUND_CUES]
      const profile = ultimate ?? standard
      if (voices.size + profile.notes.length > SOUND_CONFIG.maxVoices) return
      const { floor, attack } = SOUND_CONFIG.envelope
      const peak = ultimate ? Math.max(floor, SOUND_CONFIG.ultimatePeak * intensity) : standard.peak

      for (const [index, frequency] of profile.notes.entries()) {
        const at = start + index * profile.spacing
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()
        oscillator.type = profile.waveform
        oscillator.frequency.value = frequency * pitch
        gain.gain.setValueAtTime(floor, at)
        gain.gain.exponentialRampToValueAtTime(peak, at + attack)
        gain.gain.exponentialRampToValueAtTime(floor, at + profile.duration)
        oscillator.connect(gain)
        gain.connect(output)
        const cleanup = () => {
          voices.delete(oscillator)
          oscillator.onended = null
          oscillator.disconnect()
          gain.disconnect()
        }
        oscillator.start(at)
        oscillator.stop(at + profile.duration)
        voices.set(oscillator, cleanup)
        oscillator.onended = cleanup
      }
    },
    dispose() {
      stopVoices()
      output?.disconnect()
      output = undefined
      if (context) void context.close().catch(() => {})
      context = undefined
    },
  }
}
