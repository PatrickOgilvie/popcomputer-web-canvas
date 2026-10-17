import { asc, count, countDistinct, desc, eq, max } from 'drizzle-orm'
import { DateTime, Effect } from 'effect'
import {
  action,
  authorize,
  constraintFieldErrors,
  currentUser,
  dbBatch,
  dbQuery,
  ifChanged,
  json,
  redirect,
  render,
  validateRequest,
} from '@popcomputer/web/effect'
import { COOLDOWN_SECONDS, encodeCanvas } from '../canvas'
import { Paint } from '../forms'
import { CanvasState } from '../pages'
import { paths } from '../paths'
import { paints, pixels, user } from '../schema'

/** The newest paint's id: the canvas's version, which the live view polls. */
const latestPaintId = dbQuery((db) => db.select({ id: max(paints.id) }).from(paints)).pipe(
  Effect.map(([row]) => row?.id ?? 0)
)

/** The canvas now, the newest pixels, and who holds the most of it. */
const readState = Effect.all({
  canvas: dbQuery((db) => db.select({ x: pixels.x, y: pixels.y, color: pixels.color }).from(pixels)).pipe(
    Effect.map(encodeCanvas)
  ),
  recent: dbQuery((db) =>
    db.select({
      id: paints.id,
      x: paints.x,
      y: paints.y,
      color: paints.color,
      createdAt: paints.createdAt,
      name: user.name,
    })
      .from(paints)
      .innerJoin(user, eq(user.id, paints.userId))
      .orderBy(desc(paints.id))
      .limit(12)
  ),
  leaderboard: dbQuery((db) =>
    db.select({ name: user.name, pixels: count() })
      .from(pixels)
      .innerJoin(user, eq(user.id, pixels.userId))
      .groupBy(pixels.userId, user.name)
      .orderBy(desc(count()), asc(user.name))
      .limit(5)
  ),
}, { concurrency: 'unbounded' })

/**
 * The canvas, for anyone. A signed-in member also sees how many pixels
 * they've painted and when they may paint the next.
 */
export const showCanvas = action(
  Effect.gen(function* () {
    const visitor = yield* currentUser
    const [lastPaintId, state] = yield* Effect.all([latestPaintId, readState], { concurrency: 'unbounded' })
    const you = visitor === null
      ? null
      : yield* dbQuery((db) =>
          db.select({ painted: count(), lastAt: max(paints.createdAt) }).from(paints).where(eq(paints.userId, visitor.user.id))
        ).pipe(
          Effect.map(([row]) => {
            const lastAt = row?.lastAt ?? null
            return {
              painted: row?.painted ?? 0,
              nextPaintAt: lastAt === null ? null : new Date(lastAt.getTime() + COOLDOWN_SECONDS * 1000).toISOString(),
            }
          })
        )

    return yield* render('Canvas', { ...state, lastPaintId, you })
  })
)

/**
 * The live view's poll. The canvas's version is its newest paint, so a
 * poll that already has it gets a 304 after one indexed read.
 */
export const canvasState = action(
  Effect.gen(function* () {
    const lastPaintId = yield* latestPaintId

    return yield* ifChanged(
      `canvas-${lastPaintId}`,
      Effect.gen(function* () {
        const state = yield* readState
        return yield* json(CanvasState, { ...state, lastPaintId })
      })
    )
  })
)

/**
 * Paints one pixel, as the signed-in member. The paint and the canvas change
 * in one batch, and the trigger that refuses a paint inside the cooldown
 * undoes both.
 */
export const paint = action(
  Effect.gen(function* () {
    const auth = yield* authorize()
    const input = yield* validateRequest(Paint)
    const now = DateTime.toDateUtc(yield* DateTime.now)

    yield* dbBatch((db) => [
      db.insert(paints).values({ ...input, userId: auth.user.id, createdAt: now }),
      db.insert(pixels)
        .values({ ...input, userId: auth.user.id, paintedAt: now })
        .onConflictDoUpdate({
          target: [pixels.x, pixels.y],
          set: { color: input.color, userId: auth.user.id, paintedAt: now },
        }),
    ]).pipe(
      constraintFieldErrors({
        paints_cooldown: { pixel: `One pixel every ${COOLDOWN_SECONDS} seconds: wait a moment, then paint again.` },
      })
    )

    return yield* redirect(paths.canvas)
  })
)

/** Every paint in order, for the time-lapse. */
export const showReplay = action(
  Effect.gen(function* () {
    const [rows, painters] = yield* Effect.all([
      dbQuery((db) =>
        db.select({ x: paints.x, y: paints.y, color: paints.color }).from(paints).orderBy(asc(paints.id)).limit(50_000)
      ),
      dbQuery((db) => db.select({ painters: countDistinct(paints.userId) }).from(paints)),
    ], { concurrency: 'unbounded' })

    return yield* render('Replay', {
      paints: rows.flatMap((row) => [row.x, row.y, row.color]),
      painters: painters[0]?.painters ?? 0,
    })
  })
)
