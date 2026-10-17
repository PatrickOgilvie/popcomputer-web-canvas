import { sql } from 'drizzle-orm'
import { check, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { user } from './auth-schema'

export * from './auth-schema'

/**
 * Every pixel ever painted, in order: the live view asks for what's newer
 * than the last one it has, and the replay plays them back. The trigger in
 * migrations/0001_paint_cooldown.sql refuses a member's paint too soon after
 * their last one.
 */
export const paints = sqliteTable(
  'paints',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    x: integer('x').notNull(),
    y: integer('y').notNull(),
    color: integer('color').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [
    index('paints_user_created_idx').on(table.userId, table.createdAt),
    // The database holds the same limits the form checks, whatever writes to it.
    check('paints_x', sql`${table.x} BETWEEN 0 AND 63`),
    check('paints_y', sql`${table.y} BETWEEN 0 AND 63`),
    check('paints_color', sql`${table.color} BETWEEN 0 AND 15`),
  ]
)

/** The canvas as it is now: each pixel's latest colour, and who painted it. */
export const pixels = sqliteTable(
  'pixels',
  {
    x: integer('x').notNull(),
    y: integer('y').notNull(),
    color: integer('color').notNull(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    paintedAt: integer('painted_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.x, table.y] }),
    index('pixels_user_idx').on(table.userId),
    check('pixels_x', sql`${table.x} BETWEEN 0 AND 63`),
    check('pixels_y', sql`${table.y} BETWEEN 0 AND 63`),
    check('pixels_color', sql`${table.color} BETWEEN 0 AND 15`),
  ]
)
