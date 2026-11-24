import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const baseline = process.env.BASE_GAME_URL ?? 'http://127.0.0.1:4173/Ke-sangame/'
const candidate = process.env.GAME_URL ?? 'http://127.0.0.1:4174/Ke-sangame/'
const output = process.argv[2] ?? '/tmp/ke-sangame-issue130'
const profiles = [
  { name: 'desktop', width: 1280, height: 800, cpu: 1 },
  { name: 'mobile-4x', width: 390, height: 844, cpu: 4, touch: true },
  { name: 'mobile-4x-reduced', width: 390, height: 844, cpu: 4, touch: true, reduced: true },
]

function summary(samples) {
  assert(samples.length > 0)
  const sorted = samples.toSorted((a, b) => a - b)
  const at = (q) => Number(sorted[Math.ceil(sorted.length * q) - 1].toFixed(2))
  return { count: sorted.length, p50: at(0.5), p95: at(0.95), max: at(1) }
}

async function measure(browser, profile, name, url) {
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    isMobile: profile.touch,
    hasTouch: profile.touch,
    deviceScaleFactor: profile.touch ? 2 : 1,
    reducedMotion: profile.reduced ? 'reduce' : 'no-preference',
    serviceWorkers: 'block',
  })
  try {
    const page = await context.newPage()
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpu })
    await page.addInitScript(() => {
      let seed = 130
      Math.random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        return seed / 2 ** 32
      }
    })
    await page.goto(url)
    await page.getByRole('button', { name: 'モンスター討伐モード' }).click()
    await page.getByRole('button', { name: '足し算', exact: true }).click()
    await page.getByRole('button', { name: /^Lv\.5/ }).click()
    await page.getByRole('button', { name: '60秒', exact: true }).click()
    const autoConfirm = page.getByRole('button', { name: '自動で確定する' })
    if (await autoConfirm.getAttribute('aria-pressed') === 'true') await autoConfirm.click()
    await page.getByRole('button', { name: 'START', exact: true }).click()
    const expression = page.locator('.game-expression')
    await expression.waitFor()
    // Start sampling after the first time-density boundary at 20 seconds.
    await page.waitForFunction(() => Number(document.querySelector('[role=timer]')?.textContent) <= 39)
    await page.evaluate((touch) => {
      const metrics = { frames: [], inputDom: [], inputFrame: [], maxEnemies: 0, maxFlight: 0, golemFlights: 0, flinches: 0 }
      window.issue130 = metrics
      let previous
      const flights = new WeakSet()
      function frame(now) {
        if (previous !== undefined) metrics.frames.push(now - previous)
        previous = now
        const enemies = document.querySelectorAll('.battle-enemy')
        const ghosts = document.querySelectorAll('.attack-knockback')
        metrics.maxEnemies = Math.max(metrics.maxEnemies, enemies.length)
        metrics.maxFlight = Math.max(metrics.maxFlight, ghosts.length)
        for (const ghost of ghosts) {
          if (ghost.dataset.enemy === 'golem' && !flights.has(ghost)) metrics.golemFlights++
          flights.add(ghost)
        }
        requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
      document.addEventListener(touch ? 'click' : 'keydown', (event) => {
        const digit = touch ? event.target.closest('.game-key')?.textContent : event.key
        const answer = document.querySelector('.game-answer')
        if (!answer || !/^\d$/.test(digit ?? '')) return
        const initial = answer.textContent
        const observer = new MutationObserver(() => {
          if (answer.textContent === initial) return
          observer.disconnect()
          metrics.inputDom.push(performance.now() - event.timeStamp)
          requestAnimationFrame(() => metrics.inputFrame.push(performance.now() - event.timeStamp))
        })
        observer.observe(answer, { childList: true, characterData: true, subtree: true })
        setTimeout(() => observer.disconnect(), 500)
      }, true)
    }, Boolean(profile.touch))

    // Use real Chromium input events and verify every answer was submitted and the next question appeared.
    const send = (key) => profile.touch
      ? page.getByRole('button', { name: key, exact: true }).tap({ timeout: 2_000 })
      : page.keyboard.press(key)
    let digits = 0
    const rounds = 32
    const start = Date.now()
    for (let round = 0; round < rounds; round++) {
      const pause = start + 500 * round - Date.now()
      if (pause > 0) await page.waitForTimeout(pause)
      const question = await expression.textContent()
      const match = question.replaceAll('−', '-').replace(/[()]/g, '').match(/(-?[\d.]+)\s*\+\s*(-?[\d.]+)/)
      assert(match, question)
      const answer = String(Number((Number(match[1]) + Number(match[2])).toFixed(2)))
      for (const digit of answer) {
        if (/^\d$/.test(digit)) digits++
        await send(profile.touch && digit === '-' ? '−' : digit)
      }
      await send('Enter')
      await page.waitForFunction((previous) => document.querySelector('.game-expression')?.textContent !== previous, question)
      await page.evaluate(() => {
        const golems = document.querySelectorAll('.battle-enemy[data-enemy=golem]')
        window.issue130.flinches += [...golems].filter((golem) => golem.getAnimations().length > 0).length
      })
    }
    assert.equal(await page.locator('.battle-combo').textContent(), `${rounds} COMBO`)
    await page.waitForFunction((expected) => window.issue130.inputFrame.length >= expected, digits, { timeout: 2_000 })
    const result = await page.evaluate(() => window.issue130)
    assert.equal(result.inputDom.length, digits, 'All digit inputs should update the answer DOM')
    assert.equal(result.inputFrame.length, digits, 'All digit inputs should reach the next frame')
    assert.equal(result.maxEnemies, name === 'baseline' || profile.reduced ? 10 : 12)
    if (name === 'candidate' && !profile.reduced) {
      assert(result.maxFlight > 0 && result.flinches > 0 && result.golemFlights > 0)
    }
    const { frames, inputDom, inputFrame, ...counts } = result
    return {
      name, profile: profile.name, rounds, ...counts,
      frameMs: summary(frames), inputDomMs: summary(inputDom), inputFrameMs: summary(inputFrame),
      framesOver25Ms: frames.filter((ms) => ms > 25).length,
    }
  } finally {
    await context.close()
  }
}

await mkdir(output, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium' })
try {
  const results = []
  for (const profile of profiles.filter(({ name }) => !process.env.PROFILE || process.env.PROFILE === name)) {
    for (const [name, url] of [['baseline', baseline], ['candidate', candidate]]) {
      const result = await measure(browser, profile, name, url)
      results.push(result)
      console.log(JSON.stringify(result))
      await writeFile(`${output}/measurements.json`, JSON.stringify({ chromium: browser.version(), profiles, results }, null, 2) + '\n')
    }
  }
} finally {
  await browser.close()
}
