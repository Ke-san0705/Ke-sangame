type AnimationClip = {
  startFrame: number
  endFrame: number
  fps: number
  anchor: { x: number; y: number }
}

export type SpriteAnimation = {
  image: string
  cell: { width: number; height: number }
  grid: { columns: number; rows: number }
  animations: Readonly<Partial<Record<string, AnimationClip>>>
}

function readObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${field} must be an object`)
  }
  return value as Record<string, unknown>
}

function readInteger(value: unknown, field: string, min: number, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${field} must be an integer between ${min} and ${max}`)
  }
  return value
}

export function loadSpriteAnimation(json: string): SpriteAnimation {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (cause) {
    throw new Error('Invalid sprite animation JSON', { cause })
  }

  const data = readObject(parsed, 'Sprite animation')
  const { image } = data
  if (typeof image !== 'string' || !/^[a-z0-9][a-z0-9_-]*\.png$/.test(image)) {
    throw new Error('image must be a lowercase PNG filename')
  }

  const cell = readObject(data.cell, 'cell')
  const width = readInteger(cell.width, 'cell.width', 1)
  const height = readInteger(cell.height, 'cell.height', 1)
  const grid = readObject(data.grid, 'grid')
  const columns = readInteger(grid.columns, 'grid.columns', 1)
  const rows = readInteger(grid.rows, 'grid.rows', 1)
  const frameCount = columns * rows
  if (![frameCount, columns * width, rows * height].every(Number.isSafeInteger)) {
    throw new Error('grid frame count and sheet dimensions must be safe integers')
  }

  const entries = Object.entries(readObject(data.animations, 'animations'))
  if (entries.length === 0) {
    throw new Error('animations must contain at least one clip')
  }

  const animations: Partial<Record<string, AnimationClip>> = Object.create(null)
  for (const [name, value] of entries) {
    if (name.trim() === '') {
      throw new Error('animations must use non-blank clip names')
    }
    const field = `animations.${name}`
    const clip = readObject(value, field)
    const startFrame = readInteger(clip.startFrame, `${field}.startFrame`, 0, frameCount - 1)
    const endFrame = readInteger(clip.endFrame, `${field}.endFrame`, startFrame, frameCount - 1)
    const { fps } = clip
    if (typeof fps !== 'number' || !Number.isFinite(fps) || fps <= 0) {
      throw new Error(`${field}.fps must be a finite positive number`)
    }

    const anchor = readObject(clip.anchor, `${field}.anchor`)
    const x = readInteger(anchor.x, `${field}.anchor.x`, 0, width)
    const y = readInteger(anchor.y, `${field}.anchor.y`, 0, height)
    animations[name] = { startFrame, endFrame, fps, anchor: { x, y } }
  }

  return { image, cell: { width, height }, grid: { columns, rows }, animations }
}
