import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // Each file boots its own in-memory Postgres (PGlite) and replays real games.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Process entry points: thin wrappers around bootstrap.ts and migrate.ts, which are tested.
      exclude: ['src/**/*.test.ts', 'src/server.ts', 'src/db/migrate-cli.ts'],
      reporter: ['text-summary', 'text'],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
})
