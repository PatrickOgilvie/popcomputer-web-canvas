import { expect } from 'bun:test'
import { testBrowser, testClock, testEnv, testRateLimiter, type TestBrowser } from '@popcomputer/web/testing'
import { app } from '../src/app'
import { paths } from '../src/paths'
import { databases } from './databases'
import '../src/routes'

export { app }

/** The Worker's bindings, with a new, empty D1 database. */
export async function freshEnv() {
  return testEnv(await freshBindings())
}

async function freshBindings() {
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

export const password = 'correct horse battery'

/** A request as Inertia sends a form: its fields as JSON. */
export function send(method: 'POST' | 'PUT' | 'DELETE', fields: Record<string, unknown> = {}): RequestInit {
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

/** A member who registered through the form, signed in on a browser of their own. */
export async function register(env: Env, name: string, email = `${name.toLowerCase()}@example.com`): Promise<TestBrowser> {
  const browser = testBrowser(app, env)
  const res = await browser.request(paths.register, send('POST', { name, email, password }))

  expect(res.headers.get('Location')).toBe(paths.canvas)

  return browser
}

/** The same member on another device. */
export async function signIn(env: Env, email: string): Promise<TestBrowser> {
  const browser = testBrowser(app, env)
  const res = await browser.request(paths.login, send('POST', { email, password }))

  expect(res.headers.get('Location')).toBe(paths.canvas)

  return browser
}

/** Paint a pixel as the browser's member, and return the response. */
export function paint(browser: TestBrowser, x: number, y: number, color: number): Promise<Response> {
  return browser.request(paths.pixels, send('POST', { x, y, color }))
}
