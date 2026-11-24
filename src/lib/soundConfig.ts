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
  volumeControl: { min: 0, max: 100, step: 1 },
} as const

export const SOUND_CUES = {
  correct: { notes: [660, 880], waveform: 'sine', spacing: 0.11, duration: 0.1, peak: SOUND_CONFIG.standardPeak },
  incorrect: { notes: [180], waveform: 'triangle', spacing: 0.11, duration: 0.1, peak: 0.07 },
  countdown: { notes: [520], waveform: 'sine', spacing: 0.11, duration: 0.1, peak: SOUND_CONFIG.standardPeak },
  heartbeat: { notes: [62, 48], waveform: 'sine', spacing: 0.11, duration: 0.1, peak: SOUND_CONFIG.standardPeak },
  duelSignal: { notes: [960], waveform: 'sine', spacing: 0, duration: 0.09, peak: 0.08 },
  timeUp: { notes: [660, 494, 330], waveform: 'sine', spacing: 0.11, duration: 0.16, peak: SOUND_CONFIG.standardPeak },
  slash: { notes: [980, 570], waveform: 'triangle', spacing: 0.028, duration: 0.06, peak: 0.07 },
  flying: { notes: [420, 710, 960], waveform: 'sine', spacing: 0.035, duration: 0.09, peak: 0.07 },
  shockwave: { notes: [155, 88], waveform: 'triangle', spacing: 0.052, duration: 0.13, peak: 0.07 },
  cannon: { notes: [86, 172, 344], waveform: 'sawtooth', spacing: 0.023, duration: 0.16, peak: 0.07 },
  explosion: { notes: [128, 73, 47], waveform: 'sawtooth', spacing: 0.036, duration: 0.23, peak: 0.09 },
  heal: { notes: [523, 659, 784], waveform: 'sine', spacing: 0.065, duration: 0.15, peak: 0.08 },
  damage: { notes: [230, 116], waveform: 'triangle', spacing: 0.024, duration: 0.11, peak: 0.10 },
} as const
