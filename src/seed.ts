import { COOLDOWN_SECONDS } from './canvas'
import type { Database } from './db'
import type { Bindings } from './env'
import { paints, pixels, user } from './schema'

/**
 * The painters of the canvas's first picture: people of the seed's own, with
 * no way to sign in, so nobody paints as them.
 */
export const painters = [
  { id: 'painter-ada', name: 'Ada Lovelace', email: 'ada@painters.invalid' },
  { id: 'painter-grace', name: 'Grace Hopper', email: 'grace@painters.invalid' },
  { id: 'painter-alan', name: 'Alan Turing', email: 'alan@painters.invalid' },
] as const

// Each picture's letters are palette colours; a dot leaves the pixel blank.
const colors: Record<string, number> = { K: 3, P: 4, R: 5, O: 6, Y: 8, L: 9, G: 10, C: 11, B: 12, U: 15 }

const pictures: ReadonlyArray<{ readonly x: number; readonly y: number; readonly rows: ReadonlyArray<string> }> = [
  {
    x: 6,
    y: 6,
    rows: ['.RR...RR.', 'RRRR.RRRR', 'RRRRRRRRR', 'RRRRRRRRR', '.RRRRRRR.', '..RRRRR..', '...RRR...', '....R....'],
  },
  {
    x: 44,
    y: 5,
    rows: [
      '...YYYY...',
      '.YYYYYYYY.',
      '.YYKYYKYY.',
      'YYYKYYKYYY',
      'YYYYYYYYYY',
      'YKYYYYYYKY',
      'YYKYYYYKYY',
      '.YYKKKKYY.',
      '.YYYYYYYY.',
      '...YYYY...',
    ],
  },
  {
    x: 21,
    y: 26,
    rows: [
      'BBB.BBB.BBB',
      'B.B.B.B.B.B',
      'BBB.B.B.BBB',
      'B...B.B.B..',
      'B...BBB.B..',
    ],
  },
  { x: 0, y: 58, rows: ['L'.repeat(64), 'G'.repeat(64)] },
  { x: 10, y: 50, rows: ['..P..', '.PYP.', '..P..', '..G..', '..G..', 'G.G.G', '.GGG.', '..G..'] },
  { x: 50, y: 49, rows: ['..O..', '.OOO.', 'OOOOO', 'CCCCC', 'C.C.C', 'CCCCC', 'C...C', 'CCKCC', 'CCKCC'] },
  { x: 30, y: 44, rows: ['UUU', 'U.U', 'UUU'] },
]

/** The first picture's paints, one painter after another, ending at `now`. */
export function pictureRows(now: number) {
  const strokes = pictures.flatMap((picture) =>
    picture.rows.flatMap((row, dy) =>
      [...row].flatMap((letter, dx) => {
        const color = colors[letter]
        return color === undefined ? [] : [{ x: picture.x + dx, y: picture.y + dy, color }]
      })
    )
  )
  // The painters take turns, each a little more than the cooldown apart, ending now.
  const gap = (COOLDOWN_SECONDS + 1) * 1000
  const start = now - Math.ceil(strokes.length / painters.length) * gap
  return strokes.map((stroke, index) => ({
    ...stroke,
    userId: painters[index % painters.length]?.id ?? painters[0].id,
    createdAt: new Date(start + Math.floor(index / painters.length) * gap + (index % painters.length)),
  }))
}

/**
 * What the local database holds after `bun run db:seed`: the painters, and a
 * picture they painted together a pixel at a time, as far apart as the
 * cooldown asks. Visitors join in as guests of their own to paint on it.
 */
export async function seed(db: Database, _env: Bindings): Promise<void> {
  const now = Date.now()
  await db.insert(user).values(painters.map((painter) => ({ ...painter, emailVerified: false })))
  const rows = pictureRows(now)

  // D1 binds at most 100 values to a statement: 16 rows of 6 at a time.
  for (let index = 0; index < rows.length; index += 16) {
    const chunk = rows.slice(index, index + 16)
    await db.insert(paints).values(chunk)
    await db.insert(pixels).values(
      chunk.map(({ x, y, color, userId, createdAt }) => ({ x, y, color, userId, paintedAt: createdAt }))
    ).onConflictDoNothing()
  }
  console.log('Open the canvas and choose Join in to paint, as a guest of your own.')
}
