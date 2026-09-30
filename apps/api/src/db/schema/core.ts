import { sql } from 'drizzle-orm'
import { boolean, index, pgSchema, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * `core`: accounts shared by every game. The first four tables are Better
 * Auth 1.7's (same columns as `npx auth generate` for this configuration,
 * with time zone-aware timestamps). Better Auth checks them against its
 * expectations on startup.
 */
export const core = pgSchema('core')

const timestampTz = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

export const user = core.table('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  createdAt: timestampTz('created_at').defaultNow().notNull(),
  updatedAt: timestampTz('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const session = core.table(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestampTz('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestampTz('created_at').defaultNow().notNull(),
    updatedAt: timestampTz('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_user_id_idx').on(table.userId)],
)

export const account = core.table(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestampTz('access_token_expires_at'),
    refreshTokenExpiresAt: timestampTz('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestampTz('created_at').defaultNow().notNull(),
    updatedAt: timestampTz('updated_at')
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('account_user_id_idx').on(table.userId)],
)

export const verification = core.table(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestampTz('expires_at').notNull(),
    createdAt: timestampTz('created_at').defaultNow().notNull(),
    updatedAt: timestampTz('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
)

/** Public identity of a player. Nicknames are unique regardless of case. */
export const profile = core.table(
  'profile',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    nickname: text('nickname').notNull(),
    createdAt: timestampTz('created_at').defaultNow().notNull(),
    updatedAt: timestampTz('updated_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('profile_nickname_lower_uidx').on(sql`lower(${table.nickname})`)],
)

/** The tables Better Auth reads and writes, keyed by its model names. */
export const authSchema = { user, session, account, verification }
