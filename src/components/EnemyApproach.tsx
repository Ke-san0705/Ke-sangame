import { ENEMY_STAGE, ENEMY_TYPES } from '../lib/enemyApproachConfig'
import type { Enemy } from '../lib/enemyApproach'

const sprite = (name: string) => `${import.meta.env.BASE_URL}monsters/${name}.png`

export function EnemyApproach({ enemies }: { enemies: readonly Enemy[] }) {
  return (
    <div className="enemy-approach" aria-hidden="true">
      <img className="battle-hero" src={sprite('hero')} alt="" style={{ left: `${ENEMY_STAGE.heroX * 100}%` }} />
      {enemies.map((enemy) => (
        <img key={enemy.id} className="battle-enemy" data-enemy={enemy.type}
          src={sprite(ENEMY_TYPES[enemy.type].sprite)} alt="" style={{ left: `${enemy.x * 100}%` }} />
      ))}
    </div>
  )
}
