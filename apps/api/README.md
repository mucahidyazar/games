# API

The server behind Trap The Orb, and later the other games: accounts (Google and emailed login codes), nicknames, replay-verified ranked runs, badges and leaderboards. In production it also serves the built site, so everything is same-origin.

- [Hono](https://hono.dev) on Node 24 through `@hono/node-server`
- [Better Auth](https://better-auth.com) 1.7: Google sign-in and the email OTP plugin, stored through the Drizzle adapter
- [Drizzle ORM](https://orm.drizzle.team) on Postgres (`postgres.js`); [PGlite](https://pglite.dev) (Postgres compiled to WASM) for development and tests
- Request and response shapes come from `@games/contract`; scores are recomputed by replaying runs with `@games/trap-the-orb-engine`

## Run it locally

```sh
pnpm install
pnpm dev                        # from the repo root: the site on :3101 and the API on :3102
pnpm --filter api dev           # the API alone (tsx watch)
DATABASE_URL= pnpm --filter api dev   # force the embedded PGlite database
```

The API reads the repository-root `.env` (see [Environment](#environment)). Variables already set in the shell win, even empty ones, so `DATABASE_URL=` means "use PGlite" even when `.env` names a real server. PGlite keeps its data in `apps/api/.data/pglite` (git-ignored); delete the folder to start over.

In development the Vite server on port 3101 proxies `/api` to `http://localhost:${API_PORT}`, so the browser only ever talks to `localhost:3101`. Without Resend credentials, login codes are printed to the API log:

```text
{"level":"warn","msg":"login code (development only, not emailed)","to":"m***@example.com","code":"482913"}
```

| Command | What it does |
| --- | --- |
| `pnpm --filter api dev` | Starts the API with reload on change. Applies pending migrations first. |
| `pnpm --filter api build` | Bundles `src/server.ts` and `src/db/migrate-cli.ts` into `dist/` (tsup). Every dependency, the workspace packages included, is inlined; only the lazily loaded PGlite chunk needs `node_modules`. |
| `pnpm --filter api start` | Runs the bundle (`node dist/server.js`). |
| `pnpm --filter api test` | Runs the unit and integration tests (Vitest, in-memory PGlite). With `TEST_DATABASE_URL=postgres://…` they run on that Postgres server through postgres.js instead: each test context creates its own `api_test_*` database and drops it afterwards (the role needs `CREATEDB`); existing databases are never touched. |
| `pnpm --filter api test:coverage` | The same with V8 coverage; thresholds are 80%. |
| `pnpm --filter api typecheck` | `tsc --noEmit`. |
| `pnpm --filter api db:generate` | Writes a new SQL migration to `drizzle/` from the schema diff. Never connects to a database. |
| `pnpm --filter api db:migrate` | Applies pending migrations to `DATABASE_URL`, or to PGlite when it is empty. |

## Environment

Server settings live in the repository-root `.env` next to the site's `VITE_*` values (`.env.example` documents all of them). Empty values count as unset. The server validates everything at startup and exits with a list of problems, naming variables, never printing values.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` requires `DATABASE_URL` and a strong `BETTER_AUTH_SECRET`, makes cookies `Secure` (`__Secure-` prefix) and never logs login codes. |
| `DATABASE_URL` | empty: PGlite | `postgres://…` connection string. Required in production. |
| `BETTER_AUTH_SECRET` | ephemeral in development | Signs sessions: 32+ random characters (`openssl rand -base64 32`). Required in production. |
| `BETTER_AUTH_URL` | `http://localhost:3101` | Public URL of the site. Auth lives under `/api/auth` there, and its origin is trusted for cookies and CSRF checks. `https://traptheorb.com` in production. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | empty | Google sign-in, enabled only when both are set. |
| `RESEND_API_KEY`, `EMAIL_FROM` | empty | Login-code emails, enabled only when both are set. `EMAIL_FROM` looks like `Trap The Orb <noreply@mucahid.dev>`. |
| `API_PORT` | `3102` | Port the API listens on. |
| `STATIC_DIR` | empty | Folder of the built site to serve, e.g. `apps/web/dist`. Must contain `index.html`. |
| `ALLOWED_ORIGINS` | empty | Extra origins (comma-separated) allowed to call the API with cookies, for cross-origin setups. Enables credentialed CORS for them. Cookies are `SameSite=Lax`, so the other origin must be on the same site (e.g. `https://www.traptheorb.com` calling `https://api.traptheorb.com`). |
| `TRUST_PROXY` | `0` | Reverse proxies in front of the API. Behind one proxy (Caddy, Traefik, nginx, a PaaS router) set `1`, or every visitor shares one rate-limit bucket. Leave `0` when the API is exposed directly, so `X-Forwarded-For` cannot be forged. |
| `DB_MIGRATE` | `on` | `off` skips applying migrations on start. |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` or `silent`. |
| `PGLITE_DIR` | `apps/api/.data/pglite` | PGlite folder when `DATABASE_URL` is empty, or `memory`. |

`GET /api/config` tells the site which sign-in methods are available: `{ "auth": { "google": boolean, "email": boolean } }`. Email is `true` in development even without Resend, because codes go to the log.

## Sign-in

Better Auth is mounted at `/api/auth`. The site uses the stock client:

```ts
import { createAuthClient } from 'better-auth/react'
import { emailOTPClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({ basePath: '/api/auth', plugins: [emailOTPClient()] })

await authClient.signIn.social({ provider: 'google', callbackURL: '/profile' })
await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
await authClient.signIn.emailOtp({ email, otp })   // creates the account on first sign-in
const { data: session } = authClient.useSession()
await authClient.signOut()
```

- **Cookies:** `tto.session_token` (7 days, refreshed daily through `get-session`), `HttpOnly`, `SameSite=Lax`, `Path=/`. In production the name is `__Secure-tto.session_token` and the cookie is `Secure`. Google sign-in also sets a short-lived `tto.state` cookie.
- **Login codes:** 6 digits, valid for 10 minutes, stored hashed. At most 3 code emails and 3 sign-in attempts per minute per client address, and 5 code emails per hour per email address (so rotating IPs cannot flood someone's inbox); a code dies after 3 wrong guesses. Limits answer `429` with `Retry-After`.
- **One account per email:** Google and login codes for the same (verified) address are the same player. Linking Google fills in the name and picture.
- **Redirect targets** (`callbackURL`) must be relative paths or trusted origins; anything else is refused with `403`.

### Google OAuth client

1. In [Google Cloud Console](https://console.cloud.google.com/), open **APIs & Services → OAuth consent screen**, choose *External*, and fill in the app name, support email and the `traptheorb.com` domain. The default scopes (`openid`, `email`, `profile`) are enough.
2. Open **APIs & Services → Credentials → Create credentials → OAuth client ID** and pick **Web application**.
3. **Authorized JavaScript origins:** `http://localhost:3101` and `https://traptheorb.com`.
4. **Authorized redirect URIs:** `http://localhost:3101/api/auth/callback/google` and `https://traptheorb.com/api/auth/callback/google` (always `<BETTER_AUTH_URL>/api/auth/callback/google`).
5. Put the client ID and secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then publish the consent screen so accounts outside the test-user list can sign in.

### Resend

1. In [Resend](https://resend.com/domains), add the domain of `EMAIL_FROM` (`mucahid.dev`) and create the DNS records it lists (SPF/DKIM `TXT` records and the `MX` record for the bounce subdomain) at your DNS provider. Wait until the domain shows *Verified*.
2. Create an API key with *Sending access* (optionally restricted to that domain) and set `RESEND_API_KEY`.
3. Set `EMAIL_FROM`, e.g. `Trap The Orb <noreply@mucahid.dev>`.

A rejected send is logged as `resend rejected a login email` with Resend's reason (addresses redacted). The sign-in form still says the code was sent, so it never reveals whether an email address has an account.

## Routes

Every error is `{ "error": { "code", "message" } }`; the codes are listed in `API_ERROR_CODES` in `@games/contract`.

| Route | Auth | Notes |
| --- | --- | --- |
| `GET /api/health` | – | `{ ok: true, db: true }`; `503 db_unavailable` when the database is down. |
| `GET /api/config` | – | Available sign-in methods. |
| `GET /api/me` | session | Profile, badges, records and the daily streak (`meResponseSchema`). |
| `PUT /api/me/profile` | session | `{ nickname }`. `422 nickname_not_allowed` (profanity filter), `409 nickname_taken` (case-insensitive). 10 per minute. |
| `DELETE /api/me` | session | Deletes the account and everything it owns, clears the cookies, `204`. |
| `POST /api/runs` | session + nickname | Starts a ranked run; the server picks the seed. `201`. `409 nickname_required` without a nickname. 20 per minute. |
| `POST /api/runs/:id/finish` | session | Replays the recording and returns the authoritative result, new badges and leaderboard standings. 20 per minute, 256 KB body limit. |
| `GET /api/leaderboards?board&period&date` | optional | Top 50 plus the signed-in player's own rank (`me`). 120 per minute per address. |

How a ranked run is scored:

1. `POST /api/runs` closes any run the player left open and picks the seed (the day's shared seed for the Daily Challenge). A Daily Challenge only counts if the player has no finished ranked one for that UTC day.
2. The browser plays and records its walls, then sends `endTick`, `inputs` and what it thinks it scored.
3. The server checks the run is the player's, still open, not older than three hours plus 30 minutes, and plausible: the recording cannot cover more game time than has passed since the start (plus 5 seconds).
4. It replays the recording with the engine from the server's seed (`src/runs/verify.ts`, pure so it can move to a worker thread). The replayed score is stored; the client's claim is only kept, and logged when it differs.
5. For ranked runs, in one transaction: badges are awarded or upgraded (never downgraded), then every leaderboard table the run competes on is updated when the run beats the player's previous best.

Other protections: every non-GET `/api/*` request outside `/api/auth` must carry a trusted `Origin` header (`403 forbidden_origin`), JSON bodies must be sent as `application/json` (`415`), responses carry Hono's `secureHeaders` and `Cache-Control: no-store`, and unexpected errors become a bare `500 internal_error` (details only in the server log).

## Database and migrations

Two Postgres schemas:

- `core`, shared by every game: Better Auth's `user`, `session`, `account` and `verification`, plus `profile` (nickname, unique regardless of case).
- `traptheorb`: `run` (seed, recording summary, server result, client claims), `record` (a player's best per leaderboard table) and `badge` (highest tier per badge).

Deleting a user cascades to everything they own. The schema is in `src/db/schema/`; migrations are in `drizzle/`. Applied migrations are journaled in `drizzle.__games_api_migrations`, separate from any other Drizzle project in the same database.

```sh
pnpm --filter api db:generate   # after changing src/db/schema/*: writes drizzle/NNNN_*.sql
pnpm --filter api db:migrate    # applies pending migrations to DATABASE_URL (or PGlite)
```

The server applies pending migrations on every start (idempotent) unless `DB_MIGRATE=off`. Better Auth checks its four tables against its expectations at startup and refuses auth requests if they drift; after upgrading Better Auth, compare with `npx auth generate` and generate a migration if needed.

**The database must be reachable from wherever the API runs.** The owner's Postgres is on a LAN IP: that works from a machine on the same network, but a server in the cloud (or a container without access to that network) cannot connect. Expose it safely (VPN, SSH tunnel, a managed Postgres) before deploying elsewhere, and use `?sslmode=require` in `DATABASE_URL` when the connection leaves a trusted network.

## Docker

The root `Dockerfile` builds the site and the API and runs both from one small image (non-root, no `node_modules`, health check on `/api/health`):

```sh
docker build -t trap-the-orb .
docker run -p 3102:3102 \
  -e DATABASE_URL=postgres://user:password@db-host:5432/games \
  -e BETTER_AUTH_SECRET=… -e BETTER_AUTH_URL=https://traptheorb.com \
  -e GOOGLE_CLIENT_ID=… -e GOOGLE_CLIENT_SECRET=… \
  -e RESEND_API_KEY=… -e EMAIL_FROM="Trap The Orb <noreply@mucahid.dev>" \
  -e TRUST_PROXY=1 \
  trap-the-orb
```

`STATIC_DIR` and `NODE_ENV=production` are set in the image. The site's public build settings are build arguments: `--build-arg VITE_SITE_URL=… --build-arg VITE_ADSENSE_CLIENT=…`. Put the container behind a TLS-terminating proxy: production cookies are `Secure`, and the site's headers (the same as `apps/web/vercel.json`) include HSTS and `upgrade-insecure-requests`. To run migrations as a separate step, start with `DB_MIGRATE=off` and run `node dist/migrate.js` in the container.

## Project structure

```text
src/
├── server.ts          Process entry: config, logging, graceful shutdown
├── bootstrap.ts       Opens the database, migrates, builds the app, starts listening
├── app.ts             Middleware order and route mounting
├── env.ts             .env loading and validation
├── auth/              Better Auth config, login-code emails, session middleware
├── db/                Schema, drivers (postgres.js / PGlite), migrations
├── http/              Error shape, JSON bodies, client address, request context
├── security/          Origin (CSRF) check, rate limiter
├── me/ profile/       /api/me, nicknames, profanity filter, daily streak
├── runs/              Start/finish, replay verification, badges and records
├── leaderboards/      Tables, ranking, /api/leaderboards
├── static/            Serving the built site (production)
└── system/            /api/health and /api/config
test/                  Integration tests through app.request() on in-memory PGlite
drizzle/               SQL migrations
```
