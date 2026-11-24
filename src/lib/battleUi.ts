// Phase 1 starts before the existing release sequence resolves any defeats.
export const CHARGE_HUD = { health: 1, defeated: 0 }

export const BATTLE_FEEDBACK = {
  comboMinimum: 2,
  comboDurationMs: 850,
  hit: { offsets: [0, -3, 3, -2, 0], durationSeconds: 0.18, zoom: 1.025 },
  duelWin: { offsets: [0, 0, 0], durationSeconds: 0.24, zoom: 1.06 },
}
