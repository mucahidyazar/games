# Mucahid Games — web app

The game portal and standalone game sites, using the same layout and game code. See the [repository README](../../README.md) for the overview, the commands and the game design.

- [React 19](https://react.dev) and TypeScript in strict mode, built with [Vite 8](https://vite.dev)
- [Tailwind CSS v4](https://tailwindcss.com) through `@tailwindcss/vite`, with Plus Jakarta Sans self-hosted through Fontsource
- Trap The Orb draws on a Canvas 2D context; the rules come from `@games/trap-the-orb-engine`, and the controller runs them on a fixed 120 Hz tick and records every wall for server verification
- Absurd Trolley Problems renders a [three.js](https://threejs.org) scene through a pixel-art pipeline (low-resolution render, outlines, bloom, a fixed palette with dithering), loaded only when the game opens; Philippa Foot's cases are hand-drawn SVG scenes animated with a small requestAnimationFrame timeline (`motion/`), no animation library; each scene has a wide layout and a tall one, which the stage picks on a phone held upright
- Both games synthesise their music and sound effects with the Web Audio API (no audio files)
- [TanStack Query](https://tanstack.com/query) for server data, [Better Auth](https://better-auth.com)'s React client for sign-in, [Zod](https://zod.dev) (`zod/mini`) to validate API responses and `localStorage`
- [Vitest](https://vitest.dev), Testing Library and jsdom for unit and component tests; [Playwright](https://playwright.dev) for end-to-end tests (the API is mocked in `e2e/fakeApi.ts`)

## Pages

| Portal path | Standalone game path | Page |
| --- | --- | --- |
| `/` | — | Game catalogue, category filtering and featured game. |
| `/trap-the-orb` | `/` | Trap The Orb start menu. |
| `/trap-the-orb/play/:mode` | `/play/:mode` | Game mode: `classic`, `daily`, `timeAttack`, `limitedWalls`, `hardcore`, `zen`, `custom`. |
| `/trap-the-orb/leaderboards` | `/leaderboards` | Global tables (`?board=…&period=…&date=…`) and device scores (`?tab=device`). |
| `/absurd-trolley-problems` | — | Absurd Trolley Problems: Play, Dilemmas, Community and Compare tabs, in the game's own header. It opens on “Who’s playing?”, where each person on the device has their own game (kept in `absurdtrolley.v2.players`; names never leave the device), then on the choice of problems: the absurd dilemmas or Philippa Foot's original cases. Every tab follows the set chosen. |
| `/about` | `/about` | About the portal and the games. |
| `/profile` | `/profile` | Nickname, badges, personal bests, sign out and account deletion. |

Modes are picked on the start menu that covers the board before a run (the URL follows the choice). The About page lives at `/about`; the remaining dialogs open from URL hashes: `#how-to-play`, `#privacy`, `#account`. Legacy `#about` links redirect to the page. The game stays mounted while another page is showing, so a run survives a look at the leaderboards (it pauses).

## Language

The portal speaks English and Turkish. The TR | EN switch in the home page's header (and in Absurd Trolley Problems' header) sets `games.lang` per origin and the document's `lang`; the first visit follows the browser's language. Site chrome is translated through `src/app/copy.ts`, the portal through `src/features/portal/portalCopy.ts`; Trap The Orb's screens stay in English.

## Game headers

A game whose catalogue entry sets `hasCustomHeader` draws its own header instead of the shared one: the app leaves an empty `<header>` and passes it to the game, which fills it through a portal. Absurd Trolley Problems' header keeps the shared pieces in its own style: All games on the far left, the theme switch and sign-in on the right, its tabs centred on the page. Games without one use the shared header.

## Themes

The shared header switches between **Navy Dark** (default) and **Light**. The selection is stored as `games.theme` per origin and applied before the first paint. All pages, dialogs, forms and the canvas use the semantic tokens in `src/index.css`; no game route overrides the selected theme. Canvas palettes refresh in place without restarting the run.

## Build-time settings

The site reads the public `VITE_*` values from the repository-root `.env`. Vite embeds them in the bundle, so never put secrets in them.

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_SITE` | hostname detection; portal metadata at build time | `portal` or `traptheorb`; explicit selection wins over hostname. Use a separate build per production domain. |
| `VITE_SITE_URL` | selected site URL | Canonical base URL for the canonical link, Open Graph and JSON-LD tags, `robots.txt` and `sitemap.xml`. A malformed value fails the build. |
| `VITE_CONTACT_EMAIL` | none | Contact address shown in the privacy policy. |
| `VITE_ADSENSE_CLIENT` | none | AdSense publisher id (`ca-pub-` followed by 10–20 digits). Turns on ads and `ads.txt`. |
| `VITE_ADSENSE_SLOT_SIDEBAR` | none | Numeric AdSense ad unit id for the sidebar slot. |

An unknown `VITE_SITE` or malformed canonical URL fails the build. Other malformed optional values are ignored. With `VITE_SITE` empty, `localhost:3101` previews the portal and `traptheorb.localhost:3101` previews the game branding. Sign-in remains tied to `BETTER_AUTH_URL`; use an explicit build selection on localhost to test the other layout with the same auth origin.

```sh
VITE_SITE=portal VITE_SITE_URL= pnpm --filter web build
VITE_SITE=traptheorb VITE_SITE_URL= pnpm --filter web build
```

The commands overwrite `dist`; publish each build to its matching domain. Browser hostname detection switches the UI and document metadata, while the initial HTML, robots/sitemap and static 404 come from the build selection. In development, Vite proxies `/api` to `http://localhost:${API_PORT}` (default 3102).

## Google AdSense

1. In AdSense, create a display ad unit for a 300×250 rectangle.
2. Set `VITE_ADSENSE_CLIENT` and `VITE_ADSENSE_SLOT_SIDEBAR`, then rebuild. Until both values are valid, development builds show a "Your ad here" placeholder and production builds render nothing; no Google script loads.
3. The slot sits in the game's sidebar and next to the leaderboards. On narrow screens it stacks below.
4. `ads.txt` is generated from `VITE_ADSENSE_CLIENT` at build time.
5. **Consent:** before serving ads in the EEA, the UK or Switzerland, publish a consent message through a Google-certified CMP (for example AdSense → Privacy & messaging). The privacy policy already says consent is collected this way.
6. **Content Security Policy:** `vercel.json`, `public/_headers` and the API's static server send the same policy. It blocks inline scripts and `eval` but allows `https:` scripts, frames and connections, because AdSense loads from many regional Google domains. Keep them in sync.

## Project structure

```text
src/
├── app/                 Router (Link, navigate), hash dialogs, document metadata, language
├── sites/               Game catalogue, site identities, paths/routes and SEO
├── games/trap-the-orb/   Game components, controller, render, modes, run, state,
│                        storage, audio, badges, leaderboards and mobile-app strip
├── games/absurd-trolley-problems/
│                        Dilemmas and Philippa Foot's cases, run, progress and set state,
│                        votes, audio, the three.js scene and pixel pipeline, Blender
│                        models (assets/), the SVG motion scenes (motion/), components
├── components/          Shared UI: layout, dialog, ads, icons, error boundary
├── features/
│   ├── account/         Sign-in (Google, email code), nickname, profile page, queries
│   ├── portal/          Hero, game catalogue, categories and top players
│   └── site/            About page, privacy content and 404
├── lib/                 API client, site config, formatting, logging
└── test/                Test setup, fake API, build-plugin tests
e2e/                     Playwright specs
blender/                 Blender scripts that build Absurd Trolley Problems' models
vite-plugins/            Site-specific HTML metadata, robots.txt, sitemap.xml, ads.txt and 404.html
public/                  Icons, Open Graph image, game/portal manifests, _headers
```

## Adding another game

Add its catalogue entry in `src/sites/games.ts` (with its Turkish tagline, tags and highlights) and implementation under `src/games/`. Add a site in `src/sites/sites.ts` when it gets its own domain, and register its screen in the app. The catalogue drives portal links and sitemap entries; `hasLeaderboards` and `hasMobileApp` decide whether those pages and links exist, and `hasCustomHeader` lets the game draw its own header (see above). Keep the API static route allowlist (`apps/api/src/static/site.ts`) and any static-host rewrites (`vercel.json`) in sync with the new game prefix. Shared layout components take their brand and links from the resolved site.
