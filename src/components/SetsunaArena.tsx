import { useRef, type CSSProperties } from 'react'
import samuraiJson from '../../public/assets/initial/characters/samurai.json?raw'
import opponentJson from '../../public/assets/initial/characters/enemy-swordsman.json?raw'
import { loadSpriteAnimation, spriteFramePosition, type SpriteAnimation } from '../lib/spriteAnimation'
import { SETSUNA } from '../lib/setsunaConfig'
import { useEffectTimeline } from '../lib/useEffectTimeline'
import { BattleStage } from './BattleStage'

const sheets = {
  player: loadSpriteAnimation(samuraiJson),
  opponent: loadSpriteAnimation(opponentJson),
}
type Fighter = keyof typeof sheets
const sides = { player: 1, opponent: -1 } as const

function fighterStyle(sheet: SpriteAnimation, pose: 'sheathed' | 'defeat') {
  // Both bundled duel sheets declare these poses with the same foot anchor.
  const clip = sheet.animations[pose]!
  return {
    backgroundImage: `url("${import.meta.env.BASE_URL}assets/initial/characters/${sheet.image}")`,
    backgroundSize: `${sheet.grid.columns * 100}% ${sheet.grid.rows * 100}%`,
    backgroundPosition: spriteFramePosition(sheet, clip.endFrame),
    '--foot-x': `${clip.anchor.x * 100 / sheet.cell.width}%`,
    '--foot-y': `${clip.anchor.y * 100 / sheet.cell.height}%`,
  } as CSSProperties
}

export function SetsunaArena({ waiting, winner, playing }: {
  waiting: boolean
  winner: Fighter | null
  playing: boolean
}) {
  const arena = useRef<HTMLDivElement>(null)
  useEffectTimeline({ scope: arena, active: playing, trigger: winner ?? '', lowPower: false }, (timeline, target) => {
    if (!winner) return
    const loser = winner === 'player' ? 'opponent' : 'player'
    const camera = target.querySelector('.battle-camera')!
    const attacker = target.querySelector(`[data-fighter="${winner}"]`)!
    const defender = target.querySelector(`[data-fighter="${loser}"]`)!
    const blade = target.querySelector('.setsuna-slash')!
    const flash = target.querySelector('.setsuna-flash')!
    const direction = sides[winner]
    const { stepMs, slashMs, hitStopMs, silenceMs, fallMs, zoom, stepDistance, passDistance, followThroughDistance, fallAngle, setback, drawFrames } =
      SETSUNA.finish

    const step = stepMs / 1000
    const slash = slashMs / 1000
    const hitStop = hitStopMs / 1000
    const silence = silenceMs / 1000
    const fall = fallMs / 1000
    const strikeDistance = passDistance - stepDistance - followThroughDistance
    const impact = step + slash
    const collapse = impact + hitStop + silence

    const attackerCell = attacker.firstElementChild!
    const defenderCell = defender.firstElementChild!
    const draw = sheets[winner].animations.iai!
    const defeat = sheets[loser].animations.defeat!
    const sheathed = sheets[winner].animations.sheathed!
    const showDrawFrame = (frame: number, at: number) => {
      timeline.set(attackerCell, { backgroundPosition: spriteFramePosition(sheets[winner], frame) }, at)
    }

    timeline.to(attacker, { left: `+=${direction * stepDistance}%`, duration: step, ease: 'power1.in' }, 0)
      .to(attacker, { left: `+=${direction * strikeDistance}%`, duration: slash, ease: 'power2.out' }, step)
      .to(camera, { scale: zoom, duration: slash, ease: 'power2.out' }, step)
      .fromTo(blade, { opacity: 1, scaleX: 0, transformOrigin: direction > 0 ? 'left' : 'right' },
        { scaleX: 1, duration: slash, ease: 'power2.out' }, step)
      .set(flash, { opacity: 1 }, impact)
      .to(attacker, {
        left: `+=${direction * followThroughDistance}%`, duration: silence, ease: 'power1.out',
      }, impact + hitStop)
      .to(flash, { opacity: 0, duration: silence, ease: 'power2.out' }, impact + hitStop)
      .to(blade, { opacity: 0, duration: silence, ease: 'power2.out' }, impact + hitStop)
      .to(defender, {
        rotation: -direction * fallAngle, left: `-=${direction * setback}%`, duration: fall, ease: 'power1.in',
      }, collapse)
      .to(camera, { scale: 1, duration: fall, ease: 'power1.inOut' }, collapse)

    for (let index = 0; index < drawFrames; index++) {
      showDrawFrame(draw.startFrame + index, step * index / drawFrames)
    }
    const strikeFrames = draw.endFrame - draw.startFrame - drawFrames
    for (let index = 0; index < strikeFrames; index++) {
      showDrawFrame(draw.startFrame + drawFrames + index, step + slash * index / strikeFrames)
    }
    showDrawFrame(draw.endFrame, collapse + fall / 2)
    showDrawFrame(sheathed.endFrame, collapse + fall)
    for (let frame = defeat.startFrame; frame <= defeat.endFrame; frame++) {
      const progress = (frame - defeat.startFrame) / (defeat.endFrame - defeat.startFrame)
      timeline.set(defenderCell, { backgroundPosition: spriteFramePosition(sheets[loser], frame) }, collapse + fall * progress)
    }
  })

  const finished = winner !== null && !playing
  const style = {
    '--setsuna-pass': `${SETSUNA.finish.passDistance}%`,
    '--setsuna-setback': `${SETSUNA.finish.setback}%`,
    '--setsuna-fall': `${SETSUNA.finish.fallAngle}deg`,
  } as CSSProperties
  return (
    <div className="setsuna-stage" ref={arena} data-duel-winner={winner} data-waiting={waiting} data-finished={finished} style={style}>
      <BattleStage
        key={finished ? 'result' : 'duel'}
        className="setsuna-arena"
        rearEffects={<div className="setsuna-wind" aria-hidden="true"><i /><i /><i /></div>}
        characters={(Object.keys(sheets) as Fighter[]).map((fighter) => (
          <div className="setsuna-fighter" key={fighter} data-fighter={fighter}>
            <div className="setsuna-cell" style={fighterStyle(sheets[fighter],
              finished && fighter !== winner ? 'defeat' : 'sheathed')} aria-hidden="true" />
          </div>
        ))}
        foreground={<><div className="setsuna-flash" aria-hidden="true" /><div className="setsuna-slash" aria-hidden="true" /></>}
      />
    </div>
  )
}
