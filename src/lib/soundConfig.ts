export const SOUND_CONFIG = {
  defaultVolume: 1,
  maxVoices: 10,
  envelope: { floor: 0.001, attack: 0.01 },
  standardPeak: 0.12,
  ultimatePeak: 0.12,
  comboPitch: [
    { minCombo: 10, semitones: 7 },
    { minCombo: 5, semitones: 4 },
    { minCombo: 2, semitones: 2 },
  ],
  wind: { sampleRate: 22_050, duration: 0.72, attack: 0.22, cutoff: 460, peak: 0.075 },
  volumeControl: { min: 0, max: 100, step: 1 },
} as const

export const SOUND_CUES = {
  correct: { notes: [660, 880], waveform: 'sine', spacing: 0.11, duration: 0.1, peak: SOUND_CONFIG.standardPeak },
  incorrect: { notes: [180], waveform: 'triangle', spacing: 0.11, duration: 0.1, peak: 0.07 },
  countdown: { notes: [520], waveform: 'sine', spacing: 0.11, duration: 0.1, peak: SOUND_CONFIG.standardPeak },
  heartbeat: { notes: [62, 48], waveform: 'sine', spacing: 0.11, duration: 0.1, peak: SOUND_CONFIG.standardPeak },
  duelSignal: { notes: [960], waveform: 'sine', spacing: 0, duration: 0.09, peak: 0.08 },
  duelDraw: { notes: [1780, 1080, 510], waveform: 'triangle', spacing: 0.012, duration: 0.095, peak: 0.055 },
  duelFall: { notes: [96, 54], waveform: 'triangle', spacing: 0.031, duration: 0.16, peak: 0.09 },
  duelSheathe: { notes: [1260, 860], waveform: 'triangle', spacing: 0.022, duration: 0.068, peak: 0.048 },
  duelStrongEnemy: { notes: [110, 147, 196], waveform: 'triangle', spacing: 0.095, duration: 0.25, peak: 0.08 },
  timeUp: { notes: [660, 494, 330], waveform: 'sine', spacing: 0.11, duration: 0.16, peak: SOUND_CONFIG.standardPeak },
  slash: { notes: [980, 570], waveform: 'triangle', spacing: 0.028, duration: 0.06, peak: 0.07 },
  flying: { notes: [420, 710, 960], waveform: 'sine', spacing: 0.035, duration: 0.09, peak: 0.07 },
  shockwave: { notes: [155, 88], waveform: 'triangle', spacing: 0.052, duration: 0.13, peak: 0.07 },
  cannon: { notes: [86, 172, 344], waveform: 'sawtooth', spacing: 0.023, duration: 0.16, peak: 0.07 },
  damage: { notes: [230, 116], waveform: 'triangle', spacing: 0.024, duration: 0.11, peak: 0.10 },
} as const
