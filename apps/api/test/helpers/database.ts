import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { openDatabase } from '../../src/db/client'
import { openPglite } from '../../src/db/pglite'
import type { DatabaseHandle } from '../../src/db/types'
import { silentLogger } from '../../src/logger'

/**
 * Tests run on in-memory PGlite by default. Set TEST_DATABASE_URL to a
 * Postgres server you control to run them on the production driver
 * (postgres.js) instead: every test context then creates its own throwaway
 * database there and drops it afterwards. Existing databases are never touched.
 */
const SERVER_URL = process.env.TEST_DATABASE_URL

async function admin<T>(run: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const sql = postgres(SERVER_URL ?? '', { max: 1, onnotice: () => {} })
  try {
    return await run(sql)
  } finally {
    await sql.end()
  }
}

async function openThrowawayPostgres(): Promise<DatabaseHandle> {
  const name = `api_test_${randomUUID().replaceAll('-', '').slice(0, 16)}`
  await admin((sql) => sql.unsafe(`create database ${name}`))
  const url = new URL(SERVER_URL ?? '')
  url.pathname = `/${name}`
  const database = await openDatabase({ url: url.toString(), pgliteDir: 'memory', logger: silentLogger })
  return {
    ...database,
    close: async () => {
      await database.close()
      await admin((sql) => sql.unsafe(`drop database if exists ${name} with (force)`))
    },
  }
}

/** A fresh, empty database (migrations not applied). */
export function openTestDatabase(): Promise<DatabaseHandle> {
  return SERVER_URL ? openThrowawayPostgres() : openPglite('memory')
}
