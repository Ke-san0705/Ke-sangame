import './GameScreen.css'

export const keypadRows = ['7', '8', '9', 'C', '4', '5', '6', 'pass', '1', '2', '3', 'Enter']

export function gameKey(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return
  const key = event.key === 'Backspace' ? 'C' : event.key === 'Tab' ? 'pass' : event.key
  if (['C', 'pass', 'Enter', '.', '-'].includes(key) || /^\d$/.test(key)) return key
}

export function GameKeypad({ keys, disabled, onKey }: {
  keys: string[]
  disabled?: boolean
  onKey: (key: string, eventTime?: number) => void
}) {
  return (
    <div className="game-keypad" role="group" aria-label="テンキー">
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          className={`game-key game-key-${key === '.' ? 'decimal' : key === '−' ? 'minus' : key}`}
          onClick={(event) => onKey(key === '−' ? '-' : key, event.isTrusted ? event.timeStamp : undefined)}
        >
          {key}
        </button>
      ))}
    </div>
  )
}
