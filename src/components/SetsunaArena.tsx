import { useRef, type CSSProperties } from 'react'
import samuraiJson from '../../public/assets/initial/characters/samurai.json?raw'
import swordmasterJson from '../../public/assets/initial/characters/swordmaster.json?raw'
import opponentJson from '../../public/assets/initial/characters/enemy-swordsman.json?raw'
import { loadSpriteAnimation, spriteFramePosition, type SpriteAnimation } from '../lib/spriteAnimation'
import { SETSUNA } from '../lib/setsunaConfig'
import { useEffectTimeline } from '../lib/useEffectTimeline'
import { BattleStage } from './BattleStage'

const sheets = {
  player: loadSpriteAnimation(samuraiJson),
  opponent: loadSpriteAnimation(opponentJson),
}
const strongEnemySheets = { ...sheets, opponent: loadSpriteAnimation(swordmasterJson) }
type Fighter = keyof typeof sheets
const sides = { player: 1, opponent: -1 } as const
const { phases, spriteClip } = SETSUNA.finish.defeat
const totalWeight = phases.reduce((total, phase) => total + phase.durationWeight, 0)
const finalPhase = phases[phases.length - 1]!

function defeatTransform(phase: typeof finalPhase, side: number, dedicatedClip: boolean) {
  return {
    '--setsuna-defeat-sink': `${dedicatedClip ? 0 : phase.sinkPercent}cqh`,
    '--setsuna-defeat-angle': `${dedicatedClip ? 0 : side * phase.angle}deg`,
    '--setsuna-defeat-height': dedicatedClip ? 1 : phase.heightScale,
  }
}

function anchorStyle(sheet: SpriteAnimation, clip: ReturnType<typeof sheathedPose>) {
  return {
    '--foot-x': `${clip.anchor.x * 100 / sheet.cell.width}%`,
    '--foot-y': `${clip.anchor.y * 100 / sheet.cell.height}%`,
  }
}

function sheathedPose(sheet: SpriteAnimation) {
  return sheet.animations.sheathed ?? sheet.animations.idle!
}

function fighterStyle(sheet: SpriteAnimation, pose: 'sheathed' | 'defeat') {
  const clip = (pose === 'defeat' && sheet.animations[spriteClip]) || sheathedPose(sheet)
  return {
    backgroundImage: `url("${import.meta.env.BASE_URL}assets/initial/characters/${sheet.image}")`,
    backgroundSize: `${sheet.grid.columns * 100}% ${sheet.grid.rows * 100}%`,
    backgroundPosition: spriteFramePosition(sheet, clip.endFrame),
    ...anchorStyle(sheet, clip),
  } as CSSProperties
}

export function SetsunaArena({ waiting, winner, playing, strongEnemy }: {
  strongEnemy: boolean
  waiting: boolean
  winner: Fighter | null
  playing: boolean
}) {
  const fighters = strongEnemy ? strongEnemySheets : sheets
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
    const { stepMs, slashMs, hitStopMs, silenceMs, fallMs, zoom, stepDistance, passDistance, followThroughDistance, setback, drawFrames } =
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
    const draw = fighters[winner].animations.iai!
    const loserSheet = fighters[loser]
    const defeat = loserSheet.animations[spriteClip]
    const sheathed = sheathedPose(fighters[winner])
    const showDrawFrame = (frame: number, at: number) => {
      timeline.set(attackerCell, { backgroundPosition: spriteFramePosition(fighters[winner], frame) }, at)
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
    // The loser starts at impact while the winner finishes the existing sequence.
    const defeatDuration = hitStop + silence + fall
    timeline.set(defender, {
      '--setsuna-defeat-sink': '0cqh',
      '--setsuna-defeat-angle': '0deg',
      '--setsuna-defeat-height': 1,
    }, impact)
    let elapsedWeight = 0
    let setbackProgress = 0
    for (const phase of phases) {
      timeline.to(defender, {
        ...defeatTransform(phase, sides[loser], Boolean(defeat)),
        left: `+=${sides[loser] * setback * (phase.setbackProgress - setbackProgress)}%`,
        duration: defeatDuration * phase.durationWeight / totalWeight,
        ease: phase.ease,
      }, impact + defeatDuration * elapsedWeight / totalWeight)
      elapsedWeight += phase.durationWeight
      setbackProgress = phase.setbackProgress
    }
    if (defeat) {
      timeline.set(defenderCell, anchorStyle(loserSheet, defeat), impact)
      const frameCount = defeat.endFrame - defeat.startFrame + 1
      for (let index = 0; index < frameCount; index++) {
        timeline.set(defenderCell, {
          backgroundPosition: spriteFramePosition(loserSheet, defeat.startFrame + index),
        }, impact + defeatDuration * index / frameCount)
      }
    }
  })

  const finished = winner !== null && !playing
  const style = {
    '--setsuna-fighter-scale': SETSUNA.arena.fighterScale,
    '--setsuna-half-gap': `${SETSUNA.arena.stanceGapPercent / 2}%`,
    '--setsuna-pass': `${SETSUNA.finish.passDistance}%`,
    '--setsuna-setback': `${SETSUNA.finish.setback * finalPhase.setbackProgress}%`,
  } as CSSProperties
  return (
    <div className="setsuna-stage" ref={arena} data-duel-winner={winner} data-waiting={waiting} data-finished={finished} style={style}>
      <BattleStage
        key={finished ? 'result' : 'duel'}
        className="setsuna-arena"
        rearEffects={<div className="setsuna-wind" aria-hidden="true"><i /><i /><i /></div>}
        characters={(Object.keys(fighters) as Fighter[]).map((fighter) => {
          const sheet = fighters[fighter]
          const fallen = finished && fighter !== winner
          return (
            <div className="setsuna-fighter" key={fighter} data-fighter={fighter}
              style={fallen ? defeatTransform(finalPhase, sides[fighter], Boolean(sheet.animations[spriteClip])) as CSSProperties : undefined}>
              <div className="setsuna-cell" style={fighterStyle(sheet, fallen ? 'defeat' : 'sheathed')} aria-hidden="true" />
            </div>
          )
        })}
        foreground={<><div className="setsuna-flash" aria-hidden="true" /><div className="setsuna-slash" aria-hidden="true" /></>}
      />
    </div>
  )
}
