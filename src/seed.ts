import { createAuth } from './auth'
import { COOLDOWN_SECONDS } from './canvas'
import type { Database } from './db'
import type { Bindings } from './env'
import { paints, pixels } from './schema'

/** The member `bun run db:seed` creates, to sign in as locally. */
export const seedMember = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  password: 'at least twelve characters',
} as const

/** Two more painters, so the leaderboard and the replay have company. */
const otherPainters = [
  { name: 'Grace Hopper', email: 'grace@example.com', password: seedMember.password },
  { name: 'Alan Turing', email: 'alan@example.com', password: seedMember.password },
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

/**
 * What the local database holds after `bun run db:seed`: three members, and a
 * canvas they painted together, a pixel at a time, as far apart as the
 * cooldown asks. It runs in Bun on the local D1 database once the migrations
 * are applied, never on the deployed one, and its inserts are typed by
 * src/schema.ts like the app's own.
 */
export async function seed(db: Database, env: Bindings): Promise<void> {
  // Through Better Auth, as the sign-up form does, so the passwords sign in.
  const auth = createAuth({ db, secret: env.BETTER_AUTH_SECRET, baseURL: 'http://localhost' })
  const painters: Array<string> = []
  for (const member of [seedMember, ...otherPainters]) {
    const { user } = await auth.api.signUpEmail({ body: { ...member } })
    painters.push(user.id)
  }

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
  const start = Date.now() - Math.ceil(strokes.length / painters.length) * gap
  const rows = strokes.map((stroke, index) => ({
    ...stroke,
    userId: painters[index % painters.length] ?? '',
    createdAt: new Date(start + Math.floor(index / painters.length) * gap + (index % painters.length)),
  }))

  // D1 binds at most 100 values to a statement: 16 rows of 6 at a time.
  for (let index = 0; index < rows.length; index += 16) {
    const chunk = rows.slice(index, index + 16)
    await db.insert(paints).values(chunk)
    await db.insert(pixels).values(
      chunk.map(({ x, y, color, userId, createdAt }) => ({ x, y, color, userId, paintedAt: createdAt }))
    ).onConflictDoNothing()
  }
  console.log(`Sign in as ${seedMember.email}, with the password "${seedMember.password}".`)
}
