# Mucahid Games

The browser game portal at [games.mucahid.dev](https://games.mucahid.dev), with a shared header, footer and account system. The first game is Trap The Orb; the same game can also be built for its own domain.

Trap The Orb is a free browser arcade game made for quick sessions. Orbs bounce around the field, and you build walls to trap them in smaller and smaller spaces. Claim at least 75% of the field to clear a level. Anyone can play straight away as a guest; signing in (Google or a code sent by email) puts ranked runs on global leaderboards, keeps records and earns badges. It plays with a mouse, a keyboard or a touch screen. Mobile apps for iOS and Android are coming soon.

Play through the portal at [games.mucahid.dev/trap-the-orb](https://games.mucahid.dev/trap-the-orb), or publish the standalone build at [traptheorb.com](https://traptheorb.com).

## Repository

A pnpm workspace. More games can join later: they share the API and the `core` database schema, and each gets its own schema.

| Package | What it is |
| --- | --- |
| [`apps/web`](apps/web) | The site: React 19, Vite 8, Tailwind CSS v4, TanStack Query, Better Auth client. |
| [`apps/api`](apps/api) | The server: Hono, Better Auth (Google + email codes through Resend), Drizzle on Postgres. Verifies ranked runs by replaying them. See [its README](apps/api/README.md). |
| [`packages/trap-the-orb-engine`](packages/trap-the-orb-engine) | The pure, deterministic game engine shared by the browser and the server: field, orbs, walls, capture, levels, modes, scoring, stats, badges and replay. |
| [`packages/contract`](packages/contract) | Request and response schemas (Zod) and leaderboard definitions shared by the site and the API. |

## Getting started

You need Node.js 24 and [pnpm](https://pnpm.io) 10.

```sh
pnpm install
pnpm dev          # the site on http://localhost:3101 and the API on :3102
```

Vite proxies `/api` to the API, so the browser only ever talks to `localhost:3101` and auth cookies stay first-party. With `DATABASE_URL` empty the API uses an embedded PGlite database, and without Resend credentials it prints login codes to its log — everything works offline.

| Command (repo root) | What it does |
| --- | --- |
| `pnpm dev` | Runs the site and the API with reload on change. |
| `pnpm build` | Type-checks and builds every package: the static site into `apps/web/dist`, the API bundle into `apps/api/dist`. |
| `pnpm start` | Runs the built API, which also serves the site when `STATIC_DIR` is set. |
| `pnpm typecheck` | Type-checks every package. |
| `pnpm lint` | Lints everything with Oxlint. |
| `pnpm test` / `pnpm test:coverage` | Unit, component and integration tests in every package (Vitest; 80%+ coverage thresholds). |
| `pnpm e2e` | Builds the site and runs the Playwright tests (desktop Chrome, desktop Firefox, iPhone 13). The API is mocked. |
| `pnpm e2e:visual` / `pnpm e2e:update-visual` | Compares or re-records the visual baselines (macOS, Chromium). |

Install the Playwright browsers once with `pnpm --filter web exec playwright install chromium firefox webkit`.

## Environment

One `.env` at the repository root serves every package. [`.env.example`](.env.example) documents each variable.

- `VITE_*` values are public: Vite embeds them in the site's JavaScript. Never put secrets in them.
- Everything else is read only by the API: the database, the auth secret, Google and Resend credentials.

For production you need at least `DATABASE_URL`, `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `BETTER_AUTH_URL=https://games.mucahid.dev` and `NODE_ENV=production`, plus the Google and Resend values for sign-in. The API validates its settings at start-up and names anything missing without printing values.

### Portal and standalone domains

The same React app and game code serve both layouts:

| Deployment | Build setting | Home | Game | Leaderboards |
| --- | --- | --- | --- | --- |
| games.mucahid.dev | `VITE_SITE=portal` | Game catalogue | `/trap-the-orb` | `/trap-the-orb/leaderboards` |
| traptheorb.com | `VITE_SITE=traptheorb` | Trap The Orb | `/` | `/leaderboards` |

Both deployments expose a shared `/about` page through the same layout and theme system.

With `VITE_SITE` unset, the browser detects the configured hostname; plain `localhost` opens the portal and `traptheorb.localhost:3101` opens the standalone game. An explicit `VITE_SITE` wins over hostname detection, including on staging domains. Static build metadata defaults to the portal: make **a separate build per production domain** so the initial HTML, sitemap and static 404 have the right identity. Changing an environment variable after building does not change the bundle.

```sh
VITE_SITE=portal VITE_SITE_URL= pnpm --filter web build
VITE_SITE=traptheorb VITE_SITE_URL= pnpm --filter web build
```

Each command writes `apps/web/dist`; deploy it before building the other variant. `VITE_SITE_URL` is an optional canonical URL override; leave it empty to use the selected site's domain. Point each domain at its deployment and route `/api` to that deployment's API. Set `BETTER_AUTH_URL` to the matching public origin and register its OAuth callback. The deployments can share Postgres data, but sign-in cookies are scoped to each origin.

### Sign-in setup

- **Google:** create an OAuth client (Web application) with the authorised origins `http://localhost:3101` and the production origin (`https://games.mucahid.dev`, or `https://traptheorb.com` for that deployment), and the redirect URIs `<origin>/api/auth/callback/google`. Step-by-step instructions are in the [API README](apps/api/README.md#google-oauth-client).
- **Resend:** verify the domain of `EMAIL_FROM` (`mucahid.dev`) in Resend, then create an API key with sending access. See the [API README](apps/api/README.md#resend).

## Game design

### Levels

Level 1 has one calm orb. Level 2 adds a second orb, level 3 speeds one of them up and level 4 the other. Then a third orb joins and everyone calms down for one level — a breather — before the orbs speed up again. Each stage starts a little harder than the last: base speed rises with the orb count, and from five orbs two orbs speed up per level. Orb colour shows speed (calm blue, quick orange, fast red, blazing violet), and the HUD's gauge shows the fastest orb. The exact progression is in [`levels.ts`](packages/trap-the-orb-engine/src/levels.ts).

### Modes and fairness

- **Ranked:** Classic, Daily Challenge, Time Attack, Limited Walls and Hardcore. Their rules are fixed, so every player on a leaderboard played the same game.
- **Practice:** Zen (unlimited lives) and Custom (orbs, speed, lives, walls, timer and target area; Easy, Normal, Hard and Expert are presets inside Custom). Never ranked, so an easy setup can never top a leaderboard.

Ranked runs by signed-in players are verified by the server:

1. The server picks the seed when the run starts.
2. The browser records every wall it builds (tick, cell, direction) on a fixed 120 Hz simulation.
3. When the run ends, the server replays the recording with the same engine and stores its own result. The browser's score is never trusted.
4. Every device plays the same 300 × 150 field (turned on its side for portrait screens), so no screen shape has an advantage.
5. One open run per player, only the first Daily Challenge attempt of each UTC day is ranked (even if it is abandoned), and leaving the page submits the run as it stands, so there is nothing to gain from restarting until a lucky layout comes up.

### Leaderboards and badges

The `/trap-the-orb/leaderboards` page (`/leaderboards` on the standalone game site) has weekly and all-time tables for each ranked mode, a daily table for the Daily Challenge, and record tables: tightest trap, biggest single capture, longest flawless streak and most badge tiers. Twelve badges have bronze, silver and gold tiers, earned only in ranked runs; the profile page shows each one with the goal of its next tier. Guests keep a per-device high-score table instead.

## Deployment

The simplest setup is one container that serves both the site and the API from the same origin — build it with the root [`Dockerfile`](Dockerfile) and put it behind a TLS-terminating proxy. The [API README](apps/api/README.md#docker) lists the variables to pass.

The API needs to reach Postgres. The database in `DATABASE_URL` can be on a LAN only if the API runs on that network; otherwise use a VPN, a tunnel or a managed database, with `sslmode=require` when the connection leaves a trusted network. Migrations are applied automatically when the API starts (`DB_MIGRATE=off` turns that off; `pnpm --filter api db:migrate` runs them by hand).

The site alone can still be hosted on a static host (`apps/web/vercel.json` and `public/_headers` carry the security headers), but then `/api` must be routed to the API on the same site for sign-in to work.

### Coolify with an existing Cloudflare Tunnel

Use the root Dockerfile, context `/`, exposed port `3102`, and `VITE_SITE=portal` / `VITE_SITE_URL=https://games.mucahid.dev`. Public `VITE_*` values must be available at **build time**; changing them needs a rebuild. Database/auth/email secrets belong only in runtime variables. Keep production login-code logging disabled.

For a tunnel connector on the same server, map a free loopback port (for example `127.0.0.1:10105:3102`) and route `games.mucahid.dev` to `http://127.0.0.1:10105`. The public-hostname configuration creates tunnel DNS; avoid conflicting A records. Preserve the existing tunnel and its other applications. Postgres holds accounts and ranked runs, so maintain database backups independently.

If the connector runs on another LAN machine, bind the origin port to the Coolify server's LAN IP rather than loopback and use that IP in the service URL. Do not expose the origin port to the public Internet.

### Optional analytics and advertising

`VITE_GTM_ID` selects a GTM Web container; `VITE_GA_ID` is a direct GA4 fallback only when GTM is unset. Neither integration loads until the visitor allows analytics. “Privacy settings” in the footer can reopen or withdraw the choice. Events use only the origin/path, remove query strings/fragments and clear the referrer. They never include email addresses, profiles, form values or replay data. Google may still process technical request information and cookies/device identifiers after consent.

In GTM, use a `site_page_view` custom-event trigger and v2 data-layer variables for `page_path`, `page_location` and `page_referrer`. Use a native Google tag with `send_page_view=false` and a native GA4 `page_view` event using those fields. Fire the Google tag once per page before the event. Disable GA4 Enhanced Measurement and do not add automatic history/form/search triggers. Use native tags: the production CSP does not permit arbitrary inline Custom HTML.

Ads are disabled by default (`VITE_ADSENSE_ENABLED=false`). In that state, the home and leaderboard placements open the visitor's mail app with an advertising inquiry to `VITE_CONTACT_EMAIL` (default: `mucahidyazar@gmail.com`). No email is sent automatically and no ad script loads. Obtain publisher/slot IDs from AdSense, finish account/site approval, domain-level ads.txt verification and the required Google-certified CMP before enabling ads; the analytics panel is not that CMP. Ads are kept outside the playable game surface to reduce accidental clicks. `/ads.txt` is generated from the publisher ID while ad serving is disabled, allowing ownership verification before launch. Do not click your own ads to test.

## Contributing

Focused issues and pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md) and [GitHub Issues](https://github.com/mucahidyazar/games/issues). Do not publish credentials, private logs or personal account details.

## License

Project code is available under the [MIT License](LICENSE). Third-party assets and dependencies retain their own licenses and attribution.
