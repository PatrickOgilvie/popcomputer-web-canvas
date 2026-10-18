// Each page's props, as the Effect Schema `render` checks and encodes them
// with: a column the schema does not name never reaches the browser.
import { Schema as S, Struct } from 'effect'
import { tableSchema } from '@popcomputer/web/schema'
import * as schema from './schema'

/** A recent pixel, and who painted it: never their email or id. */
export const RecentPaint = tableSchema(schema.paints).mapFields((fields) => ({
  ...Struct.pick(fields, ['id', 'x', 'y', 'color', 'createdAt']),
  name: S.String,
}))

/**
 * What the live view needs to catch up: the whole canvas, the newest paint
 * it includes, and the latest few. `GET /canvas/state` answers it as JSON.
 */
export const CanvasState = S.Struct({
  canvas: S.String,
  lastPaintId: S.Number,
  recent: S.Array(RecentPaint),
  leaderboard: S.Array(S.Struct({ name: S.String, pixels: S.Number })),
})

export const pages = {
  'Auth/Login': S.Struct({}),
  Canvas: S.Struct({
    ...CanvasState.fields,
    /** The signed-in member's own count, and when they may paint next; null for a guest. */
    you: S.NullOr(S.Struct({ painted: S.Number, nextPaintAt: S.NullOr(S.String) })),
  }),
  /** Every paint in order, as x, y, colour, x, y, colour, ... to play back. */
  Replay: S.Struct({ paints: S.Array(S.Number), painters: S.Number }),
}
