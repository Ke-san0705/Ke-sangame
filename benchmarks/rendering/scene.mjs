const config = {
  width: 720,
  height: 480,
  enemies: 50,
  particles: 200,
  enemySize: 48,
  particleSize: 6,
  enemyImage: '/monsters/slime.png',
  particleColor: '#ffd166',
  background: '#26354d',
  seed: 95,
}

const arena = document.querySelector('#arena')
const status = document.querySelector('#status')
const renderer = new URLSearchParams(location.search).get('renderer') === 'pixi' ? 'pixi' : 'dom'
arena.style.width = `${config.width}px`
arena.style.height = `${config.height}px`

function randomGenerator(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 2 ** 32
  }
}

function makeActors() {
  const random = randomGenerator(config.seed)
  return Array.from({ length: config.enemies + config.particles }, (_, index) => {
    const enemy = index < config.enemies
    return {
      enemy,
      size: enemy ? config.enemySize : config.particleSize,
      x: random(),
      y: random(),
      phase: random() * Math.PI * 2,
      speed: 0.4 + random(),
    }
  })
}

async function mountDom(actors) {
  const nodes = actors.map(({ enemy, size }) => {
    const element = document.createElement(enemy ? 'img' : 'span')
    element.className = enemy ? 'actor' : 'actor particle'
    element.style.width = element.style.height = `${size}px`
    if (enemy) element.src = config.enemyImage
    return element
  })
  arena.replaceChildren(...nodes)
  await Promise.all(nodes.slice(0, config.enemies).map((node) => node.decode()))
  return {
    place(index, x, y, opacity) {
      nodes[index].style.transform = `translate(${x}px, ${y}px)`
      nodes[index].style.opacity = opacity
    },
    render() {},
  }
}

async function mountPixi(actors) {
  const { Application, Assets, Sprite, Texture } = await import('pixi.js')
  const app = new Application()
  await app.init({
    width: config.width, height: config.height, background: config.background,
    preference: 'webgl', resolution: 1, autoStart: false, sharedTicker: false,
  })
  arena.append(app.canvas)
  const enemyTexture = await Assets.load(config.enemyImage)
  const particleCanvas = document.createElement('canvas')
  particleCanvas.width = particleCanvas.height = config.particleSize
  const context = particleCanvas.getContext('2d')
  const radius = config.particleSize / 2
  context.fillStyle = config.particleColor
  context.beginPath()
  context.arc(radius, radius, radius, 0, Math.PI * 2)
  context.fill()
  const particleTexture = Texture.from(particleCanvas)
  const sprites = actors.map(({ enemy, size }) => {
    const sprite = new Sprite(enemy ? enemyTexture : particleTexture)
    sprite.width = sprite.height = size
    app.stage.addChild(sprite)
    return sprite
  })
  const gl = app.renderer.gl
  const debug = gl?.getExtension('WEBGL_debug_renderer_info')
  return {
    gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
    place(index, x, y, opacity) {
      sprites[index].position.set(x, y)
      sprites[index].alpha = opacity
    },
    render: () => app.render(),
  }
}

const actors = makeActors()
const scene = await (renderer === 'pixi' ? mountPixi(actors) : mountDom(actors))
const frameMs = []
const inputDispatchMs = []
const inputFeedbackMs = []
const pendingInputs = []
let measuring = false
let lastFrame
let startedAt
let pulse = 0

window.addEventListener('keydown', (event) => {
  if (event.code !== 'Space' || event.repeat) return
  event.preventDefault()
  if (measuring) {
    inputDispatchMs.push(performance.now() - event.timeStamp)
    pendingInputs.push(event.timeStamp)
  }
  pulse += 1
})

function frame(now) {
  startedAt ??= now
  const time = (now - startedAt) / 1000
  if (measuring && lastFrame !== undefined) frameMs.push(now - lastFrame)
  lastFrame = measuring ? now : undefined
  actors.forEach(({ enemy, size, x, y, phase, speed }, index) => {
    const angle = time * speed + phase
    const moveX = (x + Math.sin(angle) * 0.08 + 1) % 1
    const moveY = (y + Math.cos(angle) * 0.08 + 1) % 1
    const opacity = index === 0 && pulse % 2 ? 0.35 : enemy ? 1 : 0.55 + Math.sin(angle) * 0.35
    scene.place(index, moveX * (config.width - size), moveY * (config.height - size), opacity)
  })
  scene.render()

  // The next rAF follows submission of the frame with updated visual feedback.
  const submittedInputs = pendingInputs.splice(0)
  if (submittedInputs.length) {
    requestAnimationFrame(() => {
      if (measuring) {
        const observedAt = performance.now()
        submittedInputs.forEach((time) => inputFeedbackMs.push(observedAt - time))
      }
    })
  }
  requestAnimationFrame(frame)
}

status.textContent = `${renderer === 'pixi' ? 'PixiJS/WebGL' : 'DOM/CSS'} · 敵 ${config.enemies} 体 · 粒子 ${config.particles} 個 · Space で敵が点滅`
window.renderingBenchmark = {
  gpu: scene.gpu ?? null,
  start() {
    frameMs.length = inputDispatchMs.length = inputFeedbackMs.length = 0
    measuring = true
  },
  stop() {
    measuring = false
    return { frameMs, inputDispatchMs, inputFeedbackMs }
  },
}
requestAnimationFrame(frame)
