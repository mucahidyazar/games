import { defineConfig } from 'tsup'

/**
 * Production bundle: everything is inlined — npm packages and the workspace
 * packages (@games/*) — so the Docker image needs no node_modules. PGlite is
 * the only exception: it is the development fallback database, imported
 * lazily and never loaded when DATABASE_URL is set (always, in production).
 */
export default defineConfig({
  entry: { server: 'src/server.ts', migrate: 'src/db/migrate-cli.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  clean: true,
  splitting: true,
  sourcemap: true,
  noExternal: [/^(?!@electric-sql\/pglite)/],
  external: ['@electric-sql/pglite'],
  // Some bundled CommonJS code calls require() for Node built-ins.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
})
