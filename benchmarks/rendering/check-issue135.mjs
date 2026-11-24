import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const url = process.env.GAME_URL ?? 'http://127.0.0.1:4184/Ke-sangame/'
const output = process.argv[2] ?? '/tmp/ke-sangame-issue135'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium' })

try {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' })
  const page = await desktop.newPage()
  const button = (name) => page.getByRole('button', { name, exact: true })
  const auto = button('自動で確定する')
  const expression = page.locator('.game-expression')

  // Vary the questions reproducibly while exercising the real input and timer paths.
  await page.addInitScript(() => {
    let seed = 135
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 2 ** 32
    }
  })
  await page.goto(url)
  assert.equal(await auto.getAttribute('aria-pressed'), 'false')
  await auto.click()
  await page.reload()
  assert.equal(await auto.getAttribute('aria-pressed'), 'true')

  async function start(mode) {
    await button(mode).click()
    await button('足し算').click()
    await page.getByRole('button', { name: /^Lv\.1/ }).click()
    await button('30秒').click()
    await button('START').click()
    await expression.waitFor()
  }

  async function answer() {
    const question = await expression.textContent()
    const terms = question.match(/^(\d+)\s*\+\s*(\d+)\s*=/)
    assert(terms, question)
    for (const digit of String(Number(terms[1]) + Number(terms[2]))) {
      await page.keyboard.press(digit)
    }
    await page.waitForFunction((previous) => document.querySelector('.game-expression')?.textContent !== previous, question)
  }

  await start('計算モード')
  await answer()
  await page.getByText('正解 1', { exact: true }).waitFor()
  await page.getByRole('heading', { name: 'TIME UP!' }).waitFor({ timeout: 35_000 })
  assert.equal(await page.getByText('KO数', { exact: true }).count(), 0)
  assert.equal(await page.locator('.release-scene').count(), 0)
  await button('モード選択に戻る').click()

  await start('モンスター討伐モード')
  await page.locator('.battle-enemy').first().waitFor()
  for (let round = 0; round < 12; round++) await answer()
  assert.equal(await page.locator('.battle-combo').textContent(), '12 COMBO')
  assert.equal(await page.getByText('CRITICAL CHARGE!', { exact: true }).count(), 0)

  await page.evaluate(() => {
    const stages = []
    window.issue135Stages = stages
    const observer = new MutationObserver(() => {
      const finish = document.querySelector('.game-finish')
      const release = document.querySelector('.release-scene')
      const result = document.querySelector('.result-screen')
      const stage = finish ? 'finish' : release?.dataset.phase ?? (result ? 'result' : null)
      const ko = release?.querySelector('.release-ko')?.textContent
      if (stage && (stage !== stages.at(-1)?.stage || ko !== stages.at(-1)?.ko)) {
        stages.push({ stage, ko })
      }
      if (result) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, characterData: true, subtree: true, attributes: true })
  })
  await page.getByText('FINISH', { exact: true }).waitFor({ timeout: 35_000 })
  await page.screenshot({ path: `${output}/hunt-finish.jpg`, type: 'jpeg' })
  await page.locator('.release-ring').first().waitFor()
  await page.screenshot({ path: `${output}/hunt-release.jpg`, type: 'jpeg' })
  await page.locator('.result-screen').waitFor()
  const stages = await page.evaluate(() => window.issue135Stages)
  assert.deepEqual([...new Set(stages.map(({ stage }) => stage))], ['finish', 'gather', 'slash', 'blast', 'aftermath', 'result'])
  const koCounts = stages.filter(({ ko }) => ko).map(({ ko }) => Number(ko.replace(/[^0-9]/g, '')))
  assert(koCounts.at(-1) > koCounts[0])
  assert.deepEqual(koCounts, koCounts.toSorted((a, b) => a - b))
  const resultKo = await page.locator('.result-stats dt').filter({ hasText: /^KO数/ }).evaluate((label) =>
    Number(label.nextElementSibling.textContent.replace(/[^0-9]/g, '')),
  )
  assert.equal(resultKo, koCounts.at(-1))
  await page.screenshot({ path: `${output}/hunt-result.jpg`, type: 'jpeg' })
  await button('モード選択に戻る').click()
  await page.reload()
  await page.getByText(`累計KO数 ${resultKo}`, { exact: true }).waitFor()
  assert.equal(await auto.getAttribute('aria-pressed'), 'true')
  console.log(JSON.stringify({ hunt: { stages, resultKo } }))
  await desktop.close()

  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
      isMobile: mobile,
      hasTouch: mobile,
      serviceWorkers: 'block',
    })
    const duel = await context.newPage()
    const duelButton = (name) => duel.getByRole('button', { name, exact: true })
    await duel.goto(url)
    if (mobile) await duelButton('自動で確定する').tap()
    await duelButton('刹那').click()
    await duelButton('START').click()
    await duel.getByText('合図を待て', { exact: true }).waitFor()
    const stage = duel.locator('.setsuna-stage')
    assert.equal(await stage.evaluate((node) => getComputedStyle(node).getPropertyValue('--setsuna-fighter-scale')), '0.7')
    const fighters = await duel.locator('.setsuna-cell').evaluateAll((nodes) =>
      nodes.map((node) => {
        const { left, right, width } = node.getBoundingClientRect()
        return { left, right, width }
      }),
    )
    assert.equal(fighters.length, 2)
    assert(fighters.every(({ left, right, width }) => left >= 0 && right <= (mobile ? 390 : 1280) && width > 0))
    await duel.screenshot({ path: `${output}/setsuna-${mobile ? 'mobile' : 'desktop'}-stance.jpg`, type: 'jpeg' })
    await duel.keyboard.press(mobile ? 'Enter' : '0')
    assert.equal(await duel.getByText('お手つき 1 / 2', { exact: true }).count(), 0)
    await duel.keyboard.press(mobile ? '0' : 'Enter')
    await duel.getByText('お手つき 1 / 2', { exact: true }).waitFor()
    await duel.evaluate(() => {
      const samples = []
      window.issue135Defeat = samples
      function sample(now) {
        const root = document.querySelector('.setsuna-stage')
        if (root?.dataset.duelWinner === 'opponent') {
          const fighter = getComputedStyle(root.querySelector('[data-fighter=player]'))
          samples.push({
            now,
            finished: root.dataset.finished === 'true',
            angle: parseFloat(fighter.getPropertyValue('--setsuna-defeat-angle')) || 0,
            height: parseFloat(fighter.getPropertyValue('--setsuna-defeat-height')) || 1,
          })
          if (samples.at(-1).finished) return
        }
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    await duel.keyboard.press(mobile ? '0' : 'Enter')
    await duel.waitForFunction(() => document.querySelector('.setsuna-stage')?.dataset.finished === 'true')
    assert.equal(await stage.getAttribute('data-duel-winner'), 'opponent')
    await duel.getByText('お手つき2回', { exact: true }).waitFor()
    await duel.screenshot({ path: `${output}/setsuna-${mobile ? 'mobile' : 'desktop'}-defeat.jpg`, type: 'jpeg' })
    const samples = await duel.waitForFunction(() => window.issue135Defeat.at(-1)?.finished)
      .then(() => duel.evaluate(() => window.issue135Defeat))
    const kneel = samples.findIndex(({ height, angle }) => height < 0.85 && Math.abs(angle) < 2)
    const tilt = samples.findIndex(({ angle }) => Math.abs(angle) >= 20)
    assert(kneel >= 0 && tilt > kneel, 'The knee bend should precede the fall')
    assert.equal(samples.at(-1).angle, 83)
    const finishMs = Math.round(samples.at(-1).now - samples[0].now)
    assert(finishMs >= 700 && finishMs <= 1_000)

    await duelButton('もう一度').click()
    const equation = duel.locator('.setsuna-signal + span')
    await equation.waitFor()
    const terms = (await equation.textContent()).match(/(\d+)\s*([＋−])\s*(\d+)/)
    assert(terms)
    const answer = terms[2] === '＋' ? Number(terms[1]) + Number(terms[3]) : Number(terms[1]) - Number(terms[3])
    if (mobile) await duelButton(String(answer)).tap()
    else {
      await duel.keyboard.press(String(answer))
      assert.equal(await duel.getByText('勝利', { exact: true }).count(), 0)
      await duel.keyboard.press('Enter')
    }
    await duel.getByText('勝利', { exact: true }).waitFor()
    console.log(JSON.stringify({ setsuna: { mobile, autoConfirm: mobile, fighters, finishMs, reason: 'お手つき2回' } }))
    await context.close()
  }
} finally {
  await browser.close()
}
