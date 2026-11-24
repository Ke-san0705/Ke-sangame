import { describe, expect, it } from 'vitest'
import exampleJson from './fixtures/sprite-animation.example.json?raw'
import { loadSpriteAnimation } from './spriteAnimation'

describe('loadSpriteAnimation', () => {
  it('reads the sheet grid, inclusive frame ranges, FPS and cell-local anchors from JSON', () => {
    const definition = loadSpriteAnimation(exampleJson)

    expect(definition.image).toBe('example.png')
    expect(definition.cell).toEqual({ width: 128, height: 128 })
    expect(definition.grid).toEqual({ columns: 4, rows: 2 })
    expect(definition.animations.idle).toEqual({
      startFrame: 0,
      endFrame: 3,
      fps: 6,
      anchor: { x: 64, y: 112 },
    })
    expect(definition.animations.attack).toEqual({
      startFrame: 4,
      endFrame: 7,
      fps: 12,
      anchor: { x: 64, y: 112 },
    })
    expect(definition.animations.toString).toBeUndefined()
  })

  it('accepts a one-frame clip with its anchor on the cell bottom edge', () => {
    const data = JSON.parse(exampleJson)
    data.animations.idle.endFrame = 0
    data.animations.idle.anchor.y = 128
    expect(loadSpriteAnimation(JSON.stringify(data)).animations.idle?.anchor.y).toBe(128)
  })

  it('rejects malformed JSON', () => {
    expect(() => loadSpriteAnimation('{')).toThrow(/Invalid sprite animation JSON/)
  })

  it.each(['null', '[]', '{}'])('rejects a missing sheet definition (%s)', (json) => {
    expect(() => loadSpriteAnimation(json)).toThrow()
  })

  it.each([
    ['image', { image: 'example.jpg' }],
    ['cell', { cell: { width: 0, height: 128 } }],
    ['grid', { grid: { columns: 1.5, rows: 2 } }],
    ['grid', { grid: { columns: Number.MAX_SAFE_INTEGER, rows: 2 } }],
    ['animations', { animations: {} }],
    ['animations', { animations: [] }],
  ])('rejects an invalid %s', (field, update) => {
    const data = { ...JSON.parse(exampleJson), ...update }

    expect(() => loadSpriteAnimation(JSON.stringify(data))).toThrow(String(field))
  })

  it.each([
    ['startFrame', { startFrame: -1 }],
    ['startFrame', { startFrame: 0.5 }],
    ['endFrame', { endFrame: 8 }],
    ['endFrame', { startFrame: 2, endFrame: 1 }],
    ['fps', { fps: 0 }],
    ['fps', { fps: '12' }],
    ['anchor', { anchor: { x: 129, y: 112 } }],
    ['anchor', { anchor: { x: 64, y: -1 } }],
    ['anchor', { anchor: { x: 64 } }],
  ])('rejects an invalid clip %s without returning a partial definition', (field, update) => {
    const data = JSON.parse(exampleJson)
    data.animations.attack = { ...data.animations.attack, ...update }

    expect(() => loadSpriteAnimation(JSON.stringify(data))).toThrow('animations.attack.' + field)
  })
})
