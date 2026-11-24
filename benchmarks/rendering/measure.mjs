import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright-core'

const endpoint = process.env.BENCHMARK_URL ?? 'http://127.0.0.1:4174'
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--enable-unsafe-swiftshader'],
})

const order = ['dom', 'pixi', 'pixi', 'dom', 'dom', 'pixi']
const trials = []

try {
  for (const renderer of order) {
    const page = await browser.newPage({
      viewport: { width: 900, height: 600 }, deviceScaleFactor: 1,
    })
    await page.goto(`${endpoint}/?renderer=${renderer}`)
    await page.waitForFunction(() => Boolean(window.renderingBenchmark))
    const gpu = await page.evaluate(() => window.renderingBenchmark.gpu)
    await delay(1500)
    await page.evaluate(() => window.renderingBenchmark.start())
    for (let input = 0; input < 30; input += 1) {
      await delay(125 + (input % 5) * 7)
      await page.keyboard.press('Space')
    }
    await delay(200)
    const samples = await page.evaluate(() => window.renderingBenchmark.stop())
    if (samples.inputDispatchMs.length !== 30 || samples.inputFeedbackMs.length !== 30) {
      throw new Error(`Missing input samples in ${renderer} trial`)
    }
    trials.push({ renderer, gpu, ...samples })
    await page.close()
  }
  console.log(JSON.stringify({ chromium: browser.version(), trials }, null, 2))
} finally {
  await browser.close()
}
