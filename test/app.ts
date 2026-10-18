import { expect } from 'bun:test'
import { Layer, Redacted } from 'effect'
import { signedIn, testBrowser, testClock, testEnv, testRateLimiter, type TestBrowser } from '@popcomputer/web/testing'
import { app } from '../src/app'
import { createDb } from '../src/db'
import { user } from '../src/schema'
import { paths } from '../src/paths'
import { databases } from './databases'
import '../src/routes'

export { app }

/** The Worker's bindings, with a new, empty D1 database. */
export async function freshEnv() {
  return testEnv(await freshBindings())
}

export async function freshBindings() {
  return {
    DB: await databases.fresh(),
    BETTER_AUTH_SECRET: 'test-only-secret-0123456789abcdef0123456789',
    SIGN_IN_LIMITER: testRateLimiter(),
    ENVIRONMENT: 'test' as const,
  }
}

/** Fresh bindings and a clock the test moves, which every request reads. */
export async function clockedEnv() {
  const time = await testClock(new Date())
  return { env: testEnv(time.layer, await freshBindings()), time }
}

export type Env = Awaited<ReturnType<typeof freshEnv>>

/** A request as Inertia sends a form: its fields as JSON. */
export function send(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', fields: Record<string, unknown> = {}): RequestInit {
  return {
    method,
    headers: { 'X-Inertia': 'true', 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  }
}

/** Whether a response sends the visitor to sign in. */
export function asksToSignIn(res: Response): boolean {
  return new URL(res.headers.get('Location') ?? '/', 'http://localhost').pathname === paths.login
}

/** A visit to a page, as Inertia makes it. */
export const visit: RequestInit = { headers: { 'X-Inertia': 'true' } }

/**
 * A painter: a user row of their own, signed in as their session would sign
 * them in, with `layer` too, such as a test clock. Each painter's browser
 * shares `env`'s database.
 */
export async function member(env: Env, name: string, layer: Layer.Layer<never> = Layer.empty): Promise<TestBrowser> {
  if (env.DB === undefined) throw new Error('The test env has no DB.')
  const now = new Date()
  const row = {
    id: crypto.randomUUID(),
    name,
    email: `${name.toLowerCase()}@example.com`,
    emailVerified: false,
    image: null,
    createdAt: now,
    updatedAt: now,
    isAnonymous: false,
  }
  await createDb(env.DB).insert(user).values(row)
  const session = {
    id: `session-${row.id}`,
    token: Redacted.make(`token-${row.id}`),
    userId: row.id,
    expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
    createdAt: now,
    updatedAt: now,
    ipAddress: null,
    userAgent: null,
  }

  return testBrowser(app, testEnv(Layer.merge(signedIn({ user: row, session }), layer), env))
}

/** A visitor who joins in from the canvas: a guest painter of their own. */
export async function joinIn(env: Env): Promise<TestBrowser> {
  const browser = testBrowser(app, env)
  const res = await browser.request(paths.login, send('POST'))

  expect(res.headers.get('Location')).toBe(paths.canvas)

  return browser
}

/** Paint a pixel as the browser's member, and return the response. */
export function paint(browser: TestBrowser, x: number, y: number, color: number): Promise<Response> {
  return browser.request(paths.pixels, send('POST', { x, y, color }))
}
