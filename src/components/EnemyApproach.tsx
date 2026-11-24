import { useEffect, useEffectEvent, useState } from 'react'
import { advanceEnemies, createEnemyApproach } from '../lib/enemyApproach'
import { ENEMY_STAGE, ENEMY_TYPES } from '../lib/enemyApproachConfig'
import type { Level } from '../lib/question-generator'

const sprite = (name: string) => `${import.meta.env.BASE_URL}monsters/${name}.png`

export function EnemyApproach({ level, combo, active }: { level: Level; combo: number; active: boolean }) {
  const [battle, setBattle] = useState(createEnemyApproach)
  const tick = useEffectEvent((seconds: number) => {
    setBattle((current) => advanceEnemies(current, seconds, level, combo))
  })

  useEffect(() => {
    if (!active) return
    let lastTick = performance.now()
    const interval = window.setInterval(() => {
      const now = performance.now()
      tick((now - lastTick) / 1000)
      lastTick = now
    }, ENEMY_STAGE.tickMs)
    return () => window.clearInterval(interval)
  }, [active])

  return (
    <div className="enemy-approach" aria-hidden="true">
      <img className="battle-hero" src={sprite('hero')} alt="" style={{ left: `${ENEMY_STAGE.heroX * 100}%` }} />
      {battle.enemies.map((enemy) => (
        <img key={enemy.id} className="battle-enemy" data-enemy={enemy.type}
          src={sprite(ENEMY_TYPES[enemy.type].sprite)} alt="" style={{ left: `${enemy.x * 100}%` }} />
      ))}
    </div>
  )
}
