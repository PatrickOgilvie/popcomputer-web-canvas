/**
 * Generated requests to every route, from a signed-out visitor, Ada and
 * Grace: any method, each path spelled other ways, and bodies, queries and
 * headers a browser or an attacker sends. Whatever arrives, each answer
 * keeps the framework's rules (no 500, another site's write refused, a
 * signed-in page never kept by a shared cache, ...), no one sees another
 * member's email, id or session, no paint or session is made, changed or
 * removed by anyone but its owner, the canvas shows each paint that lands,
 * and a refused request writes nothing.
 *
 * The forms come from the routes: an action that takes `form(Schema)` is
 * sent fields that pass it, so a new one is fuzzed once it is registered. A
 * new placeholder in src/paths.ts is a type error at `params` until it is
 * given values here.
 */
import { expect, test } from 'bun:test'
import { inArray, sql } from 'drizzle-orm'
import { Redacted } from 'effect'
import {
  brokenPromises,
  fuzz,
  fuzzRequest,
  fuzzTimeout,
  leaks,
  refusedWrites,
  sendFuzzRequest,
  show,
  strangerWrites,
  type FuzzRequest,
  type Refusal,
  type RowKeys,
  type RowsChange,
} from '@popcomputer/web/fuzz'
import { signedIn, testEnv } from '@popcomputer/web/testing'
import { routes } from '../src/app'
import { CANVAS_SIZE } from '../src/canvas'
import { createDb } from '../src/db'
import { paths } from '../src/paths'
import { paints, pixels, session, user } from '../src/schema'
import { app, freshEnv } from './app'

// Text only each member's own records hold: an answer that shows it to
// anyone else leaked it. The canvas shows painters by name, never by email
// or id, and a session's token to no one.
const canaries = {
  ada: { id: 'user-ada-7f3a', email: 'ada.7f3a@example.com', token: 'token-ada-0c51' },
  grace: { id: 'user-grace-91c2', email: 'grace.91c2@example.com', token: 'token-grace-5e8d' },
}

type Person = keyof typeof canaries

const since = new Date(Date.UTC(2026, 0, 1))
const until = new Date(Date.UTC(2100, 0, 1))

const member = (person: Person, name: string) => ({
  user: {
    id: canaries[person].id,
    name,
    email: canaries[person].email,
    emailVerified: false,
    image: null,
    createdAt: since,
    updatedAt: since,
    isAnonymous: false,
  },
  // The session each is signed in with is a row of its own, which no one
  // else may end or take.
  session: {
    id: `s-${person}`,
    userId: canaries[person].id,
    token: canaries[person].token,
    expiresAt: until,
    createdAt: since,
    updatedAt: since,
    ipAddress: null,
    userAgent: null,
  },
})

const people = { ada: member('ada', 'Ada'), grace: member('grace', 'Grace') }
const seeded = [canaries.ada.id, canaries.grace.id]

/** A member as the request sees them signed in: the session's token is Redacted there. */
const signedInAs = (person: Person) => {
  const { user, session } = people[person]

  return { user, session: { ...session, token: Redacted.make(session.token) } }
}

/** The person a user id belongs to, or the id itself, such as a guest's who joined in. */
const personOf = (userId: string | null): string =>
  (Object.keys(canaries) as Person[]).find((person) => canaries[person].id === userId) ?? String(userId)

/**
 * A row's identity and owner. No route names a paint or a session in its
 * path, so no binding says who owns them, and `ownership(routes, table)`
 * has nothing to read: the owner is the row's user.
 */
const ownedByUser = <Row extends { readonly userId: string | null }>(id: (row: Row) => string): RowKeys<Row> => ({
  id,
  owner: (row) => personOf(row.userId),
})

const requests = fuzzRequest({
  paths,
  routes,
  // src/paths.ts names no record in a path.
  params: {},
  people: ['ada', 'grace'],
})

/**
 * How many cases were answered, rendered a page or the live view's JSON,
 * made a guest of a visitor who joined in, painted a pixel, and painted over
 * another member's. An app that refuses everything keeps every rule, so
 * each must happen: a failed form's 303 back reaches nothing. Signing out
 * needs Better Auth's session cookie, which `signedIn` doesn't make, so
 * test/canvas.test.ts drives it through a browser.
 */
const reached = { cases: 0, rendered: 0, joined: 0, painted: 0, paintedOver: 0 }

type PaintRow = { readonly id: number; readonly userId: string; readonly x: number; readonly y: number; readonly color: number }
type PixelRow = { readonly x: number; readonly y: number; readonly color: number; readonly userId: string | null }

/** The paints a request added. */
const added = (change: RowsChange<PaintRow>) => change.after.filter((row) => !change.before.some((was) => was.id === row.id))

/** The canvas's pixels by where they are. */
const byPlace = (rows: ReadonlyArray<PixelRow>) => new Map(rows.map((pixel) => [`${pixel.x},${pixel.y}`, pixel]))

/**
 * The canvas's own rule: a pixel changes only when a paint lands on it, and
 * then shows that paint's colour and painter.
 */
function canvasFollowsPaints(sent: FuzzRequest<Person>, paintChange: RowsChange<PaintRow>, pixelChange: RowsChange<PixelRow>): string[] {
  const before = byPlace(pixelChange.before)
  const after = byPlace(pixelChange.after)
  const landed = new Map(added(paintChange).map((paint) => [`${paint.x},${paint.y}`, paint]))
  const broken: string[] = []

  for (const [place, paint] of landed) {
    const pixel = after.get(place)

    if (pixel?.color !== paint.color || pixel.userId !== paint.userId) {
      broken.push(`painted ${show(paint)} but the canvas shows ${show(pixel)} there`)
    }
  }

  for (const [place, pixel] of after) {
    const was = before.get(place)

    if (show(was) !== show(pixel) && !landed.has(place)) {
      broken.push(`${sent.person ?? 'a visitor'} changed the pixel ${show(was)} to ${show(pixel)} without painting it`)
    }
  }

  for (const [place, pixel] of before) {
    if (!after.has(place)) broken.push(`${sent.person ?? 'a visitor'} removed the pixel ${show(pixel)}`)
  }

  return broken
}

async function send(sent: FuzzRequest<Person>): Promise<Refusal> {
  const bindings = await freshEnv()

  if (bindings.DB === undefined) throw new Error('freshEnv gives DB a database.')

  const db = createDb(bindings.DB)

  await db.insert(user).values([people.ada.user, people.grace.user])
  await db.insert(session).values([people.ada.session, people.grace.session])
  // Each has painted before, long enough ago that the cooldown has passed,
  // so the feed and the replay name both.
  await db.insert(paints).values([
    { userId: canaries.ada.id, x: 0, y: 0, color: 5, createdAt: since },
    { userId: canaries.grace.id, x: 63, y: 63, color: 12, createdAt: since },
  ])
  // Every pixel of the canvas is one of theirs, in a checkerboard, so each
  // paint lands on a member's pixel, half the time another member's.
  const last = CANVAS_SIZE - 1
  await db.run(sql`
    WITH RECURSIVE cell(x, y) AS (
      SELECT 0, 0
      UNION ALL
      SELECT CASE WHEN x = ${last} THEN 0 ELSE x + 1 END, CASE WHEN x = ${last} THEN y + 1 ELSE y END
      FROM cell WHERE x < ${last} OR y < ${last}
    )
    INSERT INTO pixels (x, y, color, user_id, painted_at)
    SELECT x, y, (x + y) % 16, CASE WHEN (x + y) % 2 = 0 THEN ${canaries.ada.id} ELSE ${canaries.grace.id} END, ${since.getTime()}
    FROM cell
  `)

  const paintRows = () =>
    db.select({ id: paints.id, userId: paints.userId, x: paints.x, y: paints.y, color: paints.color }).from(paints).orderBy(paints.id)
  const pixelRows = () =>
    db.select({ x: pixels.x, y: pixels.y, color: pixels.color, userId: pixels.userId }).from(pixels).orderBy(pixels.y, pixels.x)
  // Joining in makes a guest and their session; the members' own are watched.
  const sessionRows = () =>
    db.select({ id: session.id, userId: session.userId, token: session.token, expiresAt: session.expiresAt })
      .from(session)
      .where(inArray(session.userId, seeded))
      .orderBy(session.id)
  const memberRows = () =>
    db.select({ id: user.id, userId: user.id, name: user.name, email: user.email, isAnonymous: user.isAnonymous })
      .from(user)
      .where(inArray(user.id, seeded))
      .orderBy(user.id)
  const userCount = async () => (await db.select({ id: user.id }).from(user)).length

  const before = { paints: await paintRows(), pixels: await pixelRows(), sessions: await sessionRows(), members: await memberRows(), users: await userCount() }
  const env = sent.person === null ? bindings : testEnv(signedIn(signedInAs(sent.person)), bindings)
  const answer = await sendFuzzRequest(app, sent, env)

  // A request fetch refuses to make never reaches the Worker.
  if (answer === undefined) return undefined

  const paintChange = { before: before.paints, after: await paintRows() }
  const pixelChange = { before: before.pixels, after: await pixelRows() }
  const sessionChange = { before: before.sessions, after: await sessionRows() }
  const memberChange = { before: before.members, after: await memberRows() }
  // How many users there are, which only joining in changes.
  const usersChange = { before: [before.users], after: [await userCount()] }

  const landed = added(paintChange)
  const held = byPlace(pixelChange.before)

  reached.cases += 1
  if (answer.response.status === 200) reached.rendered += 1
  if (usersChange.after[0] !== usersChange.before[0]) reached.joined += 1
  if (landed.length > 0) reached.painted += 1
  if (landed.some((paint) => held.get(`${paint.x},${paint.y}`)?.userId !== paint.userId)) reached.paintedOver += 1

  const broken = [
    ...brokenPromises(sent, answer),
    ...leaks(sent, answer, { ada: Object.values(canaries.ada), grace: Object.values(canaries.grace) }),
    ...strangerWrites(sent, paintChange, ownedByUser((row) => String(row.id))),
    ...strangerWrites(sent, sessionChange, ownedByUser((row) => row.id)),
    ...strangerWrites(sent, memberChange, ownedByUser((row) => row.id)),
    ...canvasFollowsPaints(sent, paintChange, pixelChange),
    ...refusedWrites(answer, paintChange),
    ...refusedWrites(answer, pixelChange),
    ...refusedWrites(answer, sessionChange),
    ...refusedWrites(answer, usersChange),
  ]

  return broken.length === 0 ? undefined : `${sent.method} ${sent.path}: ${broken.join('; ')}`
}

test('any request keeps the rules, and joining in and painting reach their actions', async () => {
  await fuzz(requests, send, { runs: 200 })

  // A replay runs one case; a full run must have done each.
  if (reached.cases < 100) return

  expect(Object.entries(reached).filter(([, count]) => count === 0).map(([what]) => what)).toEqual([])
}, fuzzTimeout)
