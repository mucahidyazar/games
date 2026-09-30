/**
 * Renders the web game's canvas art, CSS art and Web Audio sounds in Chrome and writes them into the Unity
 * project, so the app looks and sounds exactly like the browser game.
 *
 *   node unity/tools/bake-web-assets/bake.cjs
 *
 * Sources it mirrors: apps/web/src/games/trap-the-orb/render/renderer.ts (ballSprite),
 * render/palette.ts (BALL_COLORS), components/OrbLineup.tsx, audio/sfx.ts and components/layout/Logo.tsx.
 */
const { createRequire } = require('node:module')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '../../..')
const webRequire = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { chromium } = webRequire('@playwright/test')

const PROJECT = path.join(ROOT, 'unity/TrapTheOrb/Assets/_Project')
const ORBS_DIR = path.join(PROJECT, 'Art/Orbs')
const ICONS_DIR = path.join(PROJECT, 'Art/AppIcon')
const AUDIO_DIR = path.join(PROJECT, 'Audio')

/** render/palette.ts */
const BALL_COLORS = [
  { highlight: '#9dd2ff', base: '#2b8cff', shade: '#0a5fe0', trail: '43 140 255' },
  { highlight: '#ffd08a', base: '#ff8c1a', shade: '#e86400', trail: '255 140 26' },
  { highlight: '#ffb3c0', base: '#ef4f6c', shade: '#c92c4a', trail: '239 79 108' },
  { highlight: '#cbb8ff', base: '#8b5cf6', shade: '#6334d8', trail: '139 92 246' },
]

/** Sprite radius in pixels; the app scales it down with mipmaps. */
const SPRITE_RADIUS = 96

async function bakeOrbSprites(page) {
  const sprites = await page.evaluate(
    ({ colors, radius }) => {
      // renderer.ts ballSprite(), unchanged apart from returning PNG data.
      const draw = (c) => {
        const pad = Math.ceil(radius * 1.1)
        const size = Math.ceil(radius * 2 + pad * 2)
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        const cx = size / 2
        const cy = size / 2
        ctx.save()
        ctx.shadowColor = `rgb(${c.trail} / 0.38)`
        ctx.shadowBlur = radius * 0.9
        ctx.shadowOffsetY = radius * 0.3
        const body = ctx.createRadialGradient(cx - radius * 0.38, cy - radius * 0.42, radius * 0.06, cx, cy, radius)
        body.addColorStop(0, c.highlight)
        body.addColorStop(0.42, c.base)
        body.addColorStop(1, c.shade)
        ctx.fillStyle = body
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
        ctx.fillStyle = 'rgb(255 255 255 / 0.78)'
        ctx.beginPath()
        ctx.ellipse(cx - radius * 0.32, cy - radius * 0.4, radius * 0.3, radius * 0.2, -0.55, 0, Math.PI * 2)
        ctx.fill()
        return { size, data: canvas.toDataURL('image/png') }
      }
      return colors.map(draw)
    },
    { colors: BALL_COLORS, radius: SPRITE_RADIUS },
  )
  sprites.forEach((sprite, tier) => writeDataUrl(path.join(ORBS_DIR, `orb-tier${tier}.png`), sprite.data))
  return sprites[0].size
}

/** OrbLineup.tsx: CSS radial gradient plus an inset shadow, screenshot on a transparent page. */
async function bakeLineupDots(page) {
  const scale = 8
  for (let tier = 0; tier < BALL_COLORS.length; tier++) {
    const color = BALL_COLORS[tier].base
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">
      <span id="dot" style="display:block;width:${14 * scale}px;height:${14 * scale}px;border-radius:50%;
        box-shadow:inset ${-1 * scale}px ${-2 * scale}px ${3 * scale}px rgb(0 0 0 / 0.2);
        background:radial-gradient(circle at 35% 30%, #ffffffcc 0 18%, ${color} 45%)"></span></body></html>`)
    await page.locator('#dot').screenshot({ path: path.join(ORBS_DIR, `lineup-tier${tier}.png`), omitBackground: true })
  }
}

const MARK = `
  <defs>
    <linearGradient id="field" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16c7ba"/><stop offset="1" stop-color="#079c91"/></linearGradient>
    <radialGradient id="orb" cx="0.36" cy="0.32" r="0.78"><stop offset="0" stop-color="#ffdcaa"/><stop offset="0.45" stop-color="#ff8c1a"/><stop offset="1" stop-color="#dd5a00"/></radialGradient>
  </defs>`
const MARK_SHAPES = `
  <path d="M26.2 7H30a3 3 0 0 1 3 3v20a3 3 0 0 1-3 3h-3.8Z" fill="#fff" fill-opacity="0.3"/>
  <rect x="22.8" y="7" width="3.4" height="26" rx="1.7" fill="#fff"/>
  <circle cx="13.6" cy="20" r="6.6" fill="url(#orb)"/>
  <ellipse cx="11.5" cy="17.6" rx="2.1" ry="1.35" transform="rotate(-35 11.5 17.6)" fill="#fff" fill-opacity="0.85"/>`

/** App icons: the logo mark full-bleed (iOS masks the corners itself) and Android's adaptive layers. */
async function bakeAppIcons(page) {
  const render = async (svg, size, file, transparent) => {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`)
    await page.locator('svg').screenshot({ path: path.join(ICONS_DIR, file), omitBackground: transparent })
  }
  const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="1024" height="1024">${MARK}
    <rect width="40" height="40" fill="url(#field)"/>${MARK_SHAPES}</svg>`
  // Android keeps the middle 66 of 108 dp visible under every mask; shrink the mark into that circle.
  const foreground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="432" height="432">${MARK}
    <g transform="translate(20 20) scale(0.72) translate(-20 -20)">${MARK_SHAPES}</g></svg>`
  const background = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="432" height="432">${MARK}
    <rect width="40" height="40" fill="url(#field)"/></svg>`
  await render(full, 1024, 'app-icon-1024.png', false)
  await render(foreground, 432, 'adaptive-foreground.png', true)
  await render(background, 432, 'adaptive-background.png', false)
}

/** audio/sfx.ts recipes, rendered offline to 16-bit WAV. */
async function bakeSounds(page) {
  const sounds = await page.evaluate(async () => {
    const NOTES = { C4: 261.63, E4: 329.63, G4: 392, C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5 }
    const SAMPLE_RATE = 44100
    const LENGTH_SECONDS = 0.8

    const tone = (ctx, output, o) => {
      const oscillator = ctx.createOscillator()
      const envelope = ctx.createGain()
      const end = o.start + o.duration
      oscillator.type = o.type
      oscillator.frequency.setValueAtTime(o.frequency, o.start)
      if (o.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(o.endFrequency, end)
      envelope.gain.setValueAtTime(0.0001, o.start)
      envelope.gain.exponentialRampToValueAtTime(o.gain, o.start + 0.012)
      envelope.gain.exponentialRampToValueAtTime(0.0001, end)
      oscillator.connect(envelope)
      envelope.connect(output)
      oscillator.start(o.start)
      oscillator.stop(end + 0.02)
    }
    const arpeggio = (ctx, output, t, notes, spacing) =>
      notes.forEach((frequency, index) =>
        tone(ctx, output, { frequency, type: 'triangle', start: t + index * spacing, duration: 0.2, gain: 0.16 }),
      )
    const recipes = {
      start: (ctx, out, t) => arpeggio(ctx, out, t, [NOTES.C5, NOTES.G5], 0.07),
      build: (ctx, out, t) => tone(ctx, out, { frequency: 900, endFrequency: 620, type: 'sine', start: t, duration: 0.07, gain: 0.12 }),
      wall: (ctx, out, t) => tone(ctx, out, { frequency: 320, endFrequency: 210, type: 'sine', start: t, duration: 0.1, gain: 0.18 }),
      capture: (ctx, out, t) => arpeggio(ctx, out, t, [NOTES.C5, NOTES.E5, NOTES.G5], 0.045),
      break: (ctx, out, t) => {
        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 1400
        filter.connect(out)
        tone(ctx, filter, { frequency: 240, endFrequency: 80, type: 'sawtooth', start: t, duration: 0.24, gain: 0.14 })
      },
      blocked: (ctx, out, t) => tone(ctx, out, { frequency: 180, type: 'square', start: t, duration: 0.05, gain: 0.04 }),
      level: (ctx, out, t) => arpeggio(ctx, out, t, [NOTES.C5, NOTES.E5, NOTES.G5, NOTES.C6], 0.075),
      gameOver: (ctx, out, t) => arpeggio(ctx, out, t, [NOTES.G4, NOTES.E4, NOTES.C4], 0.13),
    }

    const toWav = (samples) => {
      // Trim the silent tail, keep a few milliseconds of room.
      let end = samples.length
      while (end > 0 && Math.abs(samples[end - 1]) < 1e-4) end--
      end = Math.min(samples.length, end + Math.round(SAMPLE_RATE * 0.01))
      const buffer = new ArrayBuffer(44 + end * 2)
      const view = new DataView(buffer)
      const text = (offset, value) => [...value].forEach((ch, i) => view.setUint8(offset + i, ch.charCodeAt(0)))
      text(0, 'RIFF')
      view.setUint32(4, 36 + end * 2, true)
      text(8, 'WAVE')
      text(12, 'fmt ')
      view.setUint32(16, 16, true)
      view.setUint16(20, 1, true)
      view.setUint16(22, 1, true)
      view.setUint32(24, SAMPLE_RATE, true)
      view.setUint32(28, SAMPLE_RATE * 2, true)
      view.setUint16(32, 2, true)
      view.setUint16(34, 16, true)
      text(36, 'data')
      view.setUint32(40, end * 2, true)
      for (let i = 0; i < end; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true)
      let binary = ''
      new Uint8Array(buffer).forEach((byte) => (binary += String.fromCharCode(byte)))
      return btoa(binary)
    }

    const result = {}
    for (const [name, recipe] of Object.entries(recipes)) {
      const ctx = new OfflineAudioContext(1, SAMPLE_RATE * LENGTH_SECONDS, SAMPLE_RATE)
      const master = ctx.createGain()
      master.gain.value = 0.55
      master.connect(ctx.destination)
      recipe(ctx, master, 0.005)
      const rendered = await ctx.startRendering()
      result[name] = toWav(rendered.getChannelData(0))
    }
    return result
  })
  for (const [name, base64] of Object.entries(sounds)) fs.writeFileSync(path.join(AUDIO_DIR, `${name}.wav`), Buffer.from(base64, 'base64'))
  return Object.keys(sounds)
}

function writeDataUrl(file, dataUrl) {
  fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'))
}

;(async () => {
  for (const dir of [ORBS_DIR, ICONS_DIR, AUDIO_DIR]) fs.mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  await page.setContent('<!doctype html><html><body></body></html>')
  const spriteSize = await bakeOrbSprites(page)
  await bakeLineupDots(page)
  await bakeAppIcons(page)
  await page.setContent('<!doctype html><html><body></body></html>')
  const sounds = await bakeSounds(page)
  await browser.close()
  console.log(`orb sprites ${spriteSize}px (radius ${SPRITE_RADIUS}), lineup dots, app icons, sounds: ${sounds.join(', ')}`)
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
