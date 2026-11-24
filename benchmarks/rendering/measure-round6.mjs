import { chromium } from 'playwright-core'
import { mkdir, writeFile } from 'node:fs/promises'

const url = process.env.GAME_URL ?? 'http://127.0.0.1:4173/Ke-sangame/'
const output = process.argv[2] ?? '/tmp/ke-sangame-round6'
const profiles = [
  { name: 'desktop', width: 1280, height: 800, cpu: 1 },
  { name: 'mobile', width: 390, height: 844, cpu: 1, touch: true },
  { name: 'mobile-4x-reduced', width: 390, height: 844, cpu: 4, touch: true, reduced: true },
]

function summary(values) {
  if (!values.length) throw new Error('No samples collected')
  const sorted = [...values].sort((a, b) => a - b)
  const at = (q) => Number(sorted[Math.ceil(sorted.length * q) - 1].toFixed(2))
  return { count: sorted.length, p50: at(0.5), p95: at(0.95), max: at(1) }
}

await mkdir(output, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium' })
const results = []
try {
  for (const profile of profiles) {
    const context = await browser.newContext({
      viewport: { width: profile.width, height: profile.height },
      isMobile: profile.touch,
      hasTouch: profile.touch,
      deviceScaleFactor: profile.touch ? 2 : 1,
      reducedMotion: profile.reduced ? 'reduce' : 'no-preference',
    })
    const page = await context.newPage()
    const session = await context.newCDPSession(page)
    await session.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu })

    for (const mode of ['討伐', '刹那']) {
      await page.goto(url)
      await page.getByRole('button', { name: mode === '討伐' ? 'モンスター討伐モード' : mode, exact: true }).click()
      if (mode === '討伐') {
        await page.getByRole('button', { name: '足し算' }).click()
        await page.getByRole('button', { name: '30秒', exact: true }).click()
      }
      await page.getByRole('button', { name: 'START', exact: true }).click()
      const expression = page.locator(mode === '討伐' ? '.game-expression' : '.setsuna-signal + span')
      await expression.waitFor()
      await page.evaluate((touch) => {
        const metrics = { inputDom: [], inputFrame: [], frames: [], releaseFrames: [], maxEnemies: 0, maxVfx: 0, maxKnockbackSprites: 0 }
        let previous
        function frame(now) {
          if (previous !== undefined) {
            const samples = document.querySelector('.release-scene') ? metrics.releaseFrames : metrics.frames
            samples.push(now - previous)
          }
          previous = now
          metrics.maxEnemies = Math.max(metrics.maxEnemies, document.querySelectorAll('.battle-enemy').length)
          metrics.maxVfx = Math.max(metrics.maxVfx, document.querySelectorAll('[data-attack]').length)
          metrics.maxKnockbackSprites = Math.max(metrics.maxKnockbackSprites, document.querySelectorAll('.attack-knockback').length)
          requestAnimationFrame(frame)
        }
        requestAnimationFrame(frame)
        document.addEventListener(touch ? 'click' : 'keydown', (event) => {
          const digit = touch ? event.target.closest('.game-key')?.textContent : event.key
          const answer = document.querySelector('.game-answer')
          if (!answer || !/^\d$/.test(digit ?? '')) return
          const initial = answer.textContent
          const change = new MutationObserver(() => {
            if (answer.textContent === initial) return
            change.disconnect()
            metrics.inputDom.push(performance.now() - event.timeStamp)
            requestAnimationFrame(() => metrics.inputFrame.push(performance.now() - event.timeStamp))
          })
          change.observe(answer, { childList: true, characterData: true, subtree: true })
          setTimeout(() => change.disconnect(), 500)
        }, true)
        window.round6Metrics = metrics
      }, Boolean(profile.touch))
      const send = (key) => profile.touch
        ? page.getByRole('button', { name: key, exact: true }).tap()
        : page.keyboard.press(key)
      const rounds = mode === '討伐' ? 16 : 4
      for (let i = 0; i < rounds; i++) {
        const question = await expression.textContent()
        const [, left, operator, right] = question.match(/(\d+)\s*([+＋\-−])\s*(\d+)/u)
        const number = operator === '+' || operator === '＋' ? Number(left) + Number(right) : Number(left) - Number(right)
        for (const digit of String(number)) await send(digit)
        await send('Enter')
        if (mode === '刹那') {
          await page.getByText('勝利', { exact: true }).waitFor({ timeout: 1_500 })
          if (i + 1 < rounds) await expression.waitFor()
        } else {
          await page.waitForTimeout(180)
        }
      }
      const { inputDom, inputFrame, frames, releaseFrames: _releaseFrames, ...counts } = await page.evaluate(() => window.round6Metrics)
      const result = { profile: profile.name, mode, inputDomMs: summary(inputDom), inputFrameMs: summary(inputFrame), frameMs: summary(frames), ...counts }
      const scene = mode === '討伐' ? 'hunt' : 'setsuna'
      await page.screenshot({ path: `${output}/${profile.name}-${scene}.png` })
      if (mode === '討伐') {
        const blast = page.locator('.release-scene[data-phase="blast"]')
        await blast.waitFor({ timeout: 35_000 })
        const sparks = await blast.locator('.release-spark').count()
        if (profile.reduced ? sparks !== 0 : sparks === 0) throw new Error('Unexpected release particle count: ' + sparks)
        await page.screenshot({ path: `${output}/${profile.name}-release.png` })
        await page.locator('.result-screen').waitFor()
        result.releaseFrameMs = summary(await page.evaluate(() => window.round6Metrics.releaseFrames))
        result.blastSparks = sparks
      }
      results.push(result)
      console.log(profile.name, mode)
    }
    await context.close()
  }
  await writeFile(`${output}/measurements.json`, JSON.stringify({ browser: browser.version(), profiles, results }, null, 2) + '\n')
} finally {
  await browser.close()
}
