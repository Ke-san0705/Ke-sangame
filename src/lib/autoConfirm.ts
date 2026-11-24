export const DEFAULT_AUTO_CONFIRM = false

const storageKey = 'ke-sangame:auto-confirm'

export function readAutoConfirm() {
  try {
    const stored = localStorage.getItem(storageKey)
    return stored === null ? DEFAULT_AUTO_CONFIRM : stored === 'true'
  } catch {
    return DEFAULT_AUTO_CONFIRM
  }
}

export function saveAutoConfirm(enabled: boolean) {
  try {
    localStorage.setItem(storageKey, String(enabled))
  } catch {
    // Keep the in-memory setting when storage is unavailable.
  }
}

export function matchesAnswerDigitCount(input: string, answer: string) {
  if (answer.startsWith('-')) return false
  return input.replace(/\D/g, '').length === answer.replace(/\D/g, '').length
}
