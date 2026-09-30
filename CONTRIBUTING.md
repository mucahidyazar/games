# Contributing

Use Node.js 24 and `pnpm@10.30.3` with the committed lockfile. Preserve the workspace, deterministic engine and UI conventions.

- Discuss substantial game/ranking changes and new packages in an issue first.
- Add regression tests. Engine and server replay rules must remain deterministic and agree; never trust browser-supplied scores.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage` and `pnpm build`. Existing repository coverage gates apply.
- For UI changes, run relevant `pnpm e2e` checks and inspect keyboard, touch, responsive layouts, loading/error states and reduced motion. Mocked API tests do not replace real production sign-in/leaderboard verification.
- Never commit `.env`, tokens, database dumps, login codes or production account data. Only public identifiers belong in `VITE_*` values.
- Keep analytics free of account details, replay inputs and URL queries, and keep ads out of interactive gameplay controls.

Use focused pull requests with actual validation evidence. Do not re-record visual snapshots simply to hide a failure. Report sensitive security findings privately rather than posting exploit details publicly.
