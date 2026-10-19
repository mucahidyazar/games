/**
 * Renders the portal art for Absurd Trolley Problems from the game itself:
 * a 1200 × 630 cover (the key frame's opening dilemma) and a pixel-art icon.
 *
 *   pnpm dev                                   # in one terminal
 *   node apps/web/scripts/capture-trolley-art.mjs
 *
 * Needs the dev server (it uses the dev-only window.__absurdTrolley hook).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'games', 'absurd-trolley-problems')
const URL = process.env.TROLLEY_URL ?? 'http://localhost:3101/absurd-trolley-problems'

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
await page.addInitScript(() => {
  localStorage.setItem('absurdtrolley.v1.progress', JSON.stringify({ chapter: 0, index: 0, answers: {}, lang: 'en', music: false }))
  localStorage.setItem('games.analytics-consent', JSON.stringify({ analytics: false }))
})
await page.goto(URL)
await page.waitForFunction(() => Boolean(window.__absurdTrolley), null, { timeout: 60_000 })

const dataUrl = await page.evaluate(async () => {
  const stage = document.querySelector('.atp-stage')
  // Exactly 1200 × 630 CSS pixels at a device pixel ratio of 1: whole art pixels, no scaling.
  stage.style.aspectRatio = 'auto'
  stage.style.width = '1200px'
  stage.style.height = '630px'
  stage.style.maxHeight = 'none'
  await new Promise((resolve) => setTimeout(resolve, 300))
  const scene = window.__absurdTrolley
  scene.renderer.setAnimationLoop(null)
  scene.resize(1200, 630, 1)
  let time = performance.now()
  scene.lastFrame = time
  for (let i = 0; i < 240; i++) {
    time += 1000 / 60
    scene.frame(time)
  }
  return scene.renderer.domElement.toDataURL('image/png')
})
await mkdir(OUT, { recursive: true })
await writeFile(join(OUT, 'cover.png'), Buffer.from(dataUrl.split(',')[1], 'base64'))

// The icon: the tram's lit front on the night navy, drawn pixel by pixel.
const icon = await page.evaluate(() => {
  const art = [
    '................................',
    '................................',
    '..........XXXXXXXXXXXX..........',
    '...............XX...............',
    '.............XXXXXX.............',
    '.......XXXXXXXXXXXXXXXXXX.......',
    '......XggggggggggggggggggX......',
    '.....XBBBBBBBBBBBBBBBBBBBBX.....',
    '.....XBOOOOOOOOOOOOOOOOOOBX.....',
    '.....XBBBBBBBBBBBBBBBBBBBBX.....',
    '.....XCCCCCCCCCCCCCCCCCCCCX.....',
    '.....XCWWWWWWWWWWWWWWWWWWCX.....',
    '.....XCWWWWWWWWWWWWWWWWWWCX.....',
    '.....XCWWWWWWWDDWWWWWWWWWCX.....',
    '.....XCWWWWWWDDDDWWWWWWWWCX.....',
    '.....XCWWWWWWDDDDWWWWWWWWCX.....',
    '.....XCCCCCCCCCCCCCCCCCCCCX.....',
    '.....XBBBBBBBBBBBBBBBBBBBBX.....',
    '.....XBBYYYBBBBBBBBBBYYYBBX.....',
    '.....XBYYYYYBBBBBBBBYYYYYBX.....',
    '.....XBBYYYBBBBBBBBBBYYYBBX.....',
    '.....XBBBBBBBBBBBBBBBBBBBBX.....',
    '.....XbbbbbbbbbbbbbbbbbbbbX.....',
    '......XXXXXXXXXXXXXXXXXXXX......',
    '......XKKKKKKKKKKKKKKKKKKX......',
    '.......XXXXXXXXXXXXXXXXXX.......',
    '................................',
    '..RRRRRRRRRRRRRRRRRRRRRRRRRRRR..',
    '..SSSSSSSSSSSSSSSSSSSSSSSSSSSS..',
    '................................',
    '................................',
    '................................',
  ]
  const colors = { X: '#0a1226', g: '#b8c0cc', B: '#2f56b0', b: '#23346b', O: '#ffb347', C: '#efe6cf', W: '#ffd27a', D: '#3a4a6e', Y: '#fff3c4', K: '#23262e', R: '#c9d2dc', S: '#6b4a33' }
  const size = 32
  const scale = 16
  const canvas = document.createElement('canvas')
  canvas.width = size * scale
  canvas.height = size * scale
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#0b1630'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  // A soft halo of headlight behind the tram.
  ctx.fillStyle = '#13254a'
  ctx.fillRect(3 * scale, 3 * scale, 26 * scale, 26 * scale)
  art.forEach((row, y) => [...row].forEach((c, x) => {
    if (!colors[c]) return
    ctx.fillStyle = colors[c]
    ctx.fillRect(x * scale, y * scale, scale, scale)
  }))
  return canvas.toDataURL('image/png')
})
await writeFile(join(OUT, 'icon.png'), Buffer.from(icon.split(',')[1], 'base64'))
await browser.close()
console.log(`Wrote ${join(OUT, 'cover.png')} and icon.png`)
