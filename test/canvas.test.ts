import { describe, expect, test } from 'bun:test'
import { readPage, testBrowser, type TestBrowser } from '@popcomputer/web/testing'
import { CANVAS_SIZE, colorAt, COOLDOWN_SECONDS } from '../src/canvas'
import { paths } from '../src/paths'
import { app, asksToSignIn, clockedEnv, freshEnv, joinIn, member, paint, visit } from './app'

const canvasPage = async (browser: TestBrowser) => (await readPage(await browser.request(paths.canvas, visit), 'Canvas')).props

describe('watching', () => {
  test('anyone can watch the canvas, blank to begin with', async () => {
    const guest = testBrowser(app, await freshEnv())
    const canvas = await canvasPage(guest)

    expect(canvas.canvas).toBe('0'.repeat(CANVAS_SIZE * CANVAS_SIZE))
    expect(canvas.you).toBeNull()
    expect(canvas.lastPaintId).toBe(0)
  })

  test('a guest who paints is asked to sign in, and the canvas stays as it was', async () => {
    const env = await freshEnv()
    const guest = testBrowser(app, env)

    expect(asksToSignIn(await paint(guest, 1, 1, 5))).toBe(true)
    expect((await canvasPage(guest)).lastPaintId).toBe(0)
  })
})

describe('painting', () => {
  test('a pixel lands where it was painted, with who painted it', async () => {
    const browser = await member(await freshEnv(), 'Ada')
    const res = await paint(browser, 12, 40, 5)

    expect(res.headers.get('Location')).toBe(paths.canvas)

    const canvas = await canvasPage(browser)

    expect(colorAt(canvas.canvas, 12, 40)).toBe(5)
    expect(canvas.canvas.replaceAll('0', '')).toBe('5')
    expect(canvas.recent.map((recent) => [recent.name, recent.x, recent.y, recent.color])).toEqual([['Ada', 12, 40, 5]])
    expect(canvas.leaderboard).toEqual([{ name: 'Ada', pixels: 1 }])
    expect(canvas.you?.painted).toBe(1)
    expect(canvas.you?.nextPaintAt).not.toBeNull()
  })

  test('a pixel and a colour must be on the canvas and in the palette', async () => {
    const browser = await member(await freshEnv(), 'Ada')
    await browser.request(paths.canvas, visit)
    const res = await browser.request(paths.pixels, {
      method: 'POST',
      headers: { 'X-Inertia': 'true', 'Content-Type': 'application/json' },
      body: JSON.stringify({ x: CANVAS_SIZE, y: -1, color: 16 }),
    })
    const canvas = await readPage(await browser.follow(res), 'Canvas')

    expect(Object.keys(canvas.props.errors).sort()).toEqual(['color', 'x', 'y'])
    expect(canvas.props.lastPaintId).toBe(0)
  })

  test(`a member paints one pixel every ${COOLDOWN_SECONDS} seconds, whatever they send`, async () => {
    const { env, time } = await clockedEnv()
    const browser = await member(env, 'Ada', time.layer)
    await browser.request(paths.canvas, visit)

    await paint(browser, 0, 0, 5)
    const tooSoon = await paint(browser, 1, 0, 6)
    const refused = await readPage(await browser.follow(tooSoon), 'Canvas')

    expect(refused.props.errors.pixel).toMatch(/one pixel every/i)
    expect(colorAt(refused.props.canvas, 1, 0)).toBe(0)
    expect(refused.props.you?.painted).toBe(1)

    await time.advance(`${COOLDOWN_SECONDS - 1} seconds`)
    await paint(browser, 1, 0, 6)

    expect(colorAt((await canvasPage(browser)).canvas, 1, 0)).toBe(0)

    await time.advance('1 second')
    await paint(browser, 1, 0, 6)

    expect(colorAt((await canvasPage(browser)).canvas, 1, 0)).toBe(6)
  })

  test('the cooldown is each member’s own', async () => {
    const env = await freshEnv()
    const ada = await member(env, 'Ada')
    const grace = await member(env, 'Grace')

    await paint(ada, 0, 0, 5)
    await paint(grace, 1, 0, 6)

    const canvas = await canvasPage(ada)

    expect([colorAt(canvas.canvas, 0, 0), colorAt(canvas.canvas, 1, 0)]).toEqual([5, 6])
  })

  test('painting over a pixel takes it on the leaderboard', async () => {
    const env = await freshEnv()
    const ada = await member(env, 'Ada')
    const grace = await member(env, 'Grace')

    await paint(ada, 3, 3, 5)
    await paint(grace, 3, 3, 12)

    const canvas = await canvasPage(ada)

    expect(colorAt(canvas.canvas, 3, 3)).toBe(12)
    expect(canvas.leaderboard).toEqual([{ name: 'Grace', pixels: 1 }])
    expect(canvas.recent.map((recent) => recent.name)).toEqual(['Grace', 'Ada'])
  })
})

describe('the live view', () => {
  test('answers 304 until someone paints', async () => {
    const env = await freshEnv()
    const ada = await member(env, 'Ada')
    const watcher = testBrowser(app, env)
    const json = { headers: { Accept: 'application/json' } }

    const first = await watcher.request(paths.canvasState, json)
    const etag = first.headers.get('ETag') ?? ''

    expect(first.status).toBe(200)
    expect(etag).not.toBe('')

    const unchanged = await watcher.request(paths.canvasState, { headers: { ...json.headers, 'If-None-Match': etag } })

    expect(unchanged.status).toBe(304)

    await paint(ada, 7, 7, 9)
    const changed = await watcher.request(paths.canvasState, { headers: { ...json.headers, 'If-None-Match': etag } })
    const state = (await changed.json()) as { canvas: string; lastPaintId: number }

    expect(changed.status).toBe(200)
    expect(changed.headers.get('ETag')).not.toBe(etag)
    expect(colorAt(state.canvas, 7, 7)).toBe(9)
    expect(state.lastPaintId).toBe(1)
  })
})

describe('the replay', () => {
  test('plays every paint back in order, overwritten ones included', async () => {
    const env = await freshEnv()
    const ada = await member(env, 'Ada')
    const grace = await member(env, 'Grace')
    await paint(ada, 1, 2, 3)
    await paint(grace, 1, 2, 4)

    const replay = await readPage(await testBrowser(app, env).request(paths.replay, visit), 'Replay')

    expect(replay.props.paints).toEqual([1, 2, 3, 1, 2, 4])
    expect(replay.props.painters).toBe(2)
  })
})

describe('joining in', () => {
  test('one click makes a guest painter, back on the canvas, and nobody registers', async () => {
    const env = await freshEnv()
    const guest = await joinIn(env)
    const canvas = await canvasPage(guest)

    expect(canvas.auth.user?.isAnonymous).toBe(true)
    expect(canvas.auth.user?.name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/)
    expect(canvas.you).toEqual({ painted: 0, nextPaintAt: null })
    expect((await testBrowser(app, env).request('/register', visit)).status).toBe(404)
  })

  test('each guest paints under their own name, with a cooldown of their own', async () => {
    const env = await freshEnv()
    const first = await joinIn(env)
    const second = await joinIn(env)

    await paint(first, 1, 1, 5)
    await paint(second, 2, 2, 6)

    const canvas = await canvasPage(first)

    expect([colorAt(canvas.canvas, 1, 1), colorAt(canvas.canvas, 2, 2)]).toEqual([5, 6])
    expect(new Set(canvas.recent.map((recent) => recent.name)).size).toBe(2)
  })
})
