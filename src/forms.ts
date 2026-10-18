// The fields each form sends, which its action validates and its page types
// its form with. The browser imports this module only with `import type`.
import { Schema as S } from 'effect'
import { between } from '@popcomputer/web/schema'
import { CANVAS_SIZE, palette } from './canvas'

const coordinate = between(0, CANVAS_SIZE - 1, `Pick a pixel on the canvas, from 0 to ${CANVAS_SIZE - 1}.`).check(
  S.isInt({ message: 'Pick a whole pixel.' })
)

/** One pixel: where, and which of the palette's colours. */
export const Paint = S.Struct({
  x: coordinate,
  y: coordinate,
  color: between(0, palette.length - 1, 'Pick one of the palette’s colours.').check(
    S.isInt({ message: 'Pick one of the palette’s colours.' })
  ),
})
