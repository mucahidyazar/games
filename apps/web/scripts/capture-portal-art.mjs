/**
 * Renders the portal's link preview: a 1200 × 630 card (public/portal/og-image.jpg)
 * on the home page's night sky, with the brand, the hero line and every game's cover.
 *
 *   node apps/web/scripts/capture-portal-art.mjs
 *
 * Needs no server: it composes public/ files in a blank page. Rerun it when a game
 * joins the catalogue or a cover changes.
 */
import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { GAMES as CATALOGUE } from '../src/sites/games.ts'

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..')
const TYPES = { '.png': 'image/png', '.woff2': 'font/woff2' }
/** Inlined, because a page set from a string may not load local files. */
const file = (path) => `data:${TYPES[extname(path)]};base64,${readFileSync(join(WEB, path)).toString('base64')}`

/** Newest first: it is drawn in front, largest. */
const GAMES = [...CATALOGUE]
  .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt))
  .map((game) => ({ name: game.name, cover: `public${game.cover}`, icon: `public${game.icon}` }))

const html = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  @font-face {
    font-family: 'Plus Jakarta Sans';
    font-weight: 200 800;
    src: url('${file('node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2')}') format('woff2');
  }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: 1200px; height: 630px; overflow: hidden; background: #071225; }
  body { position: relative; font-family: 'Plus Jakarta Sans', sans-serif; color: #fff; }
  .sky { position: absolute; inset: 0; background: url('${file('public/portal/portal-hero-v1.png')}') 62% 30% / cover; }
  .shade {
    position: absolute; inset: 0;
    background:
      linear-gradient(90deg, rgb(7 18 37 / 0.94) 0%, rgb(7 18 37 / 0.82) 38%, rgb(7 18 37 / 0.3) 72%, rgb(7 18 37 / 0.15) 100%),
      linear-gradient(0deg, rgb(7 18 37 / 0.7) 0%, transparent 40%);
  }
  .brand { position: absolute; left: 64px; top: 56px; display: flex; align-items: center; gap: 16px; font-size: 30px; font-weight: 800; letter-spacing: -0.02em; }
  .brand svg { width: 54px; height: 54px; }
  .brand span { font-weight: 600; opacity: 0.65; }
  .copy { position: absolute; left: 64px; top: 170px; width: 620px; }
  h1 { font-size: 70px; line-height: 0.98; font-weight: 800; letter-spacing: -0.055em; }
  h1 span { display: block; }
  h1 .glow { background: linear-gradient(90deg, #99f6e4, #fff 55%, #ddd6fe); -webkit-background-clip: text; background-clip: text; color: transparent; padding-bottom: 6px; }
  p { margin-top: 26px; font-size: 26px; line-height: 1.35; font-weight: 600; color: rgb(255 255 255 / 0.74); }
  .games { position: absolute; left: 64px; bottom: 56px; display: flex; gap: 12px; padding: 0; list-style: none; }
  .games li {
    display: flex; align-items: center; gap: 10px; padding: 7px 18px 7px 7px; border-radius: 999px;
    background: rgb(255 255 255 / 0.1); border: 1px solid rgb(255 255 255 / 0.16);
    font-size: 20px; font-weight: 700; letter-spacing: -0.01em;
  }
  .games img { width: 34px; height: 34px; border-radius: 9px; image-rendering: pixelated; }
  .card {
    position: absolute; overflow: hidden; border-radius: 22px;
    border: 2px solid rgb(255 255 255 / 0.22);
    box-shadow: 0 30px 60px -18px rgb(0 0 0 / 0.75), 0 0 0 1px rgb(0 0 0 / 0.25);
  }
  .card img { display: block; width: 100%; height: 100%; object-fit: cover; }
</style>
</head>
<body>
  <div class="sky"></div>
  <div class="shade"></div>
  <div class="brand">
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <defs><linearGradient id="tile" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6" /><stop offset="1" stop-color="#0bb3a8" /></linearGradient></defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#tile)" />
      <path d="M14 12h12a8 8 0 0 1 8 8v3.6a4.6 4.6 0 0 1-8.5 2.5l-1-1.6h-9l-1 1.6A4.6 4.6 0 0 1 6 23.6V20a8 8 0 0 1 8-8Z" fill="#fff" />
      <path d="M13.5 16v6.4M10.3 19.2h6.4" stroke="#0f2548" stroke-opacity="0.55" stroke-width="2.2" stroke-linecap="round" />
      <circle cx="25.2" cy="17.6" r="1.7" fill="#0f2548" fill-opacity="0.55" />
      <circle cx="28.8" cy="21" r="1.7" fill="#0f2548" fill-opacity="0.55" />
    </svg>
    <div>games<span>.mucahid.dev</span></div>
  </div>
  <div class="copy">
    <h1><span>Play in seconds.</span><span class="glow">Make it count.</span></h1>
    <p>Free browser games.<br />No download, no sign-up.</p>
  </div>
  <ul class="games">
    ${GAMES.map((game) => `<li><img src="${file(game.icon)}" alt="" />${game.name}</li>`).join('')}
  </ul>
  ${GAMES.map((game, index) => {
    // The first card sits in front, lower and larger; the rest fan out behind it.
    const [left, top, width, turn] = [[704, 262, 450, 3], [690, 58, 410, -5], [670, 30, 370, -10]][index] ?? [670, 30, 370, -10]
    return `<div class="card" style="left:${left}px;top:${top}px;width:${width}px;height:${Math.round((width * 630) / 1200)}px;transform:rotate(${turn}deg);z-index:${10 - index}">
      <img src="${file(game.cover)}" alt="" />
    </div>`
  }).join('\n')}
</body>
</html>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'load' })
await page.evaluate(() => document.fonts.ready)
// JPEG: the painted sky would make a PNG several times larger, and chat apps drop big previews.
const out = join(WEB, 'public', 'portal', 'og-image.jpg')
await writeFile(out, await page.screenshot({ type: 'jpeg', quality: 86 }))
await browser.close()
console.log(`wrote ${out}`)
