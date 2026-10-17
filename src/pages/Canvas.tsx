import { Head, Link, router, usePage } from '@inertiajs/react'
import type { PagePropsFor, WebPage } from '@popcomputer/web/react'
import { Clapperboard, Minus, Paintbrush, Plus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { CANVAS_SIZE, colorAt, COOLDOWN_SECONDS, palette, withPixel } from '~/canvas'
import { buttonClassName } from '~/components/button'
import { cn } from '~/components/cn'
import { formatRelativeTime } from '~/components/format'
import Layout from '~/components/Layout'
import PageHeader from '~/components/PageHeader'
import PixelCanvas, { type Cell } from '~/components/PixelCanvas'
import UnderTheHood, { Guarantee } from '~/components/UnderTheHood'
import { paths } from '~/paths'

type Props = PagePropsFor<'Canvas'>
type State = Pick<Props, 'canvas' | 'lastPaintId' | 'recent' | 'leaderboard'>

const cardClassName = 'rounded-lg border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900'

/** How often the live view asks whether anything changed. */
const POLL_MS = 2000

/**
 * Keeps the canvas live: asks `GET /canvas/state` every two seconds while the
 * tab is visible, with the version it has, so an unchanged canvas is a 304.
 */
function useLiveState(initial: State) {
  const [state, setState] = useState(initial)
  const etag = useRef<string | null>(null)

  // A paint's own redirect brings the page's props: take them when newer.
  // Each is the same object until a visit replaces the page's props.
  const { canvas, lastPaintId, recent, leaderboard } = initial
  useEffect(() => {
    setState((current) =>
      lastPaintId >= current.lastPaintId ? { canvas, lastPaintId, recent, leaderboard } : current
    )
  }, [canvas, lastPaintId, recent, leaderboard])

  useEffect(() => {
    let stopped = false
    let timer: number | undefined

    async function poll() {
      if (document.visibilityState === 'visible') {
        try {
          const res = await fetch(paths.canvasState, {
            headers: { Accept: 'application/json', ...(etag.current === null ? {} : { 'If-None-Match': etag.current }) },
          })
          if (res.status === 200) {
            etag.current = res.headers.get('ETag')
            const next = (await res.json()) as State
            setState((current) => (next.lastPaintId >= current.lastPaintId ? next : current))
          }
        } catch {
          // Offline for a moment: the next poll tries again.
        }
      }
      if (!stopped) timer = window.setTimeout(poll, POLL_MS)
    }

    timer = window.setTimeout(poll, POLL_MS)
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [])

  return state
}

/** Seconds until `nextPaintAt`, ticking down; 0 once the member may paint. */
function useSecondsUntil(nextPaintAt: string | null): number {
  const [now, setNow] = useState(() => Date.now())
  const until = nextPaintAt === null ? 0 : Date.parse(nextPaintAt)

  useEffect(() => {
    if (until <= Date.now()) return
    const timer = window.setInterval(() => setNow(Date.now()), 200)
    return () => window.clearInterval(timer)
  }, [until])

  return Math.max(0, Math.ceil((until - now) / 1000))
}

function PalettePicker({ color, onChange }: { readonly color: number; readonly onChange: (color: number) => void }) {
  return (
    <fieldset>
      <legend className="sr-only">Colour</legend>
      <div className="grid w-fit grid-cols-8 gap-1.5">
        {palette.map((swatch, index) => (
          <label
            key={swatch.hex}
            title={swatch.name}
            className="relative flex size-8 cursor-pointer items-center justify-center rounded-md ring-1 ring-zinc-950/15 ring-inset has-checked:ring-2 has-checked:ring-zinc-950 has-checked:ring-offset-2 has-checked:ring-offset-white has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-orange-600 dark:ring-white/20 dark:has-checked:ring-white dark:has-checked:ring-offset-zinc-900"
            style={{ backgroundColor: swatch.hex }}
          >
            <input
              type="radio"
              name="color"
              value={index}
              checked={color === index}
              className="sr-only"
              onChange={() => onChange(index)}
            />
            <span className="sr-only">{swatch.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function Swatch({ color, className }: { readonly color: number; readonly className?: string }) {
  return (
    <span
      className={cn('inline-block size-3 shrink-0 rounded-sm ring-1 ring-zinc-950/15 ring-inset dark:ring-white/20', className)}
      style={{ backgroundColor: palette[color]?.hex }}
      aria-hidden="true"
    />
  )
}

/** One shared canvas: anyone watches it change, members paint a pixel at a time. */
const CanvasPage: WebPage<'Canvas'> = (props) => {
  const { errors } = usePage().props
  const state = useLiveState({
    canvas: props.canvas,
    lastPaintId: props.lastPaintId,
    recent: props.recent,
    leaderboard: props.leaderboard,
  })
  const [color, setColor] = useState(5)
  const [zoom, setZoom] = useState(1)
  const [cursor, setCursor] = useState<Cell | null>(null)
  const [pending, setPending] = useState<(Cell & { color: number }) | null>(null)
  const waiting = useSecondsUntil(props.you?.nextPaintAt ?? null)
  const signedIn = props.you !== null
  const canPaint = signedIn && waiting === 0 && pending === null

  const shown = pending === null ? state.canvas : withPixel(state.canvas, pending.x, pending.y, pending.color)

  const paint = useCallback(
    (cell: Cell) => {
      if (!canPaint) return
      setPending({ ...cell, color })
      router.post(
        paths.pixels,
        { ...cell, color },
        { preserveScroll: true, preserveState: true, onFinish: () => setPending(null) }
      )
    },
    [canPaint, color]
  )

  const under = cursor === null ? null : colorAt(shown, cursor.x, cursor.y)

  return (
    <>
      <Head title="Canvas" />
      <Layout>
        <PageHeader
          title="The canvas"
          description={`${CANVAS_SIZE} by ${CANVAS_SIZE} pixels, shared by everyone. Each member paints one pixel every ${COOLDOWN_SECONDS} seconds.`}
          meta={
            <span className="flex items-center gap-2">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              Live
            </span>
          }
          actions={
            <Link href={paths.replay} className={buttonClassName({ variant: 'secondary' })}>
              <Clapperboard aria-hidden="true" />
              Watch the replay
            </Link>
          }
        />

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section aria-label="Canvas" className="flex min-w-0 flex-col gap-4">
            <div className={cn(cardClassName, 'flex flex-col gap-4 p-4')}>
              {signedIn ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <PalettePicker color={color} onChange={setColor} />
                  <p
                    className={cn(
                      'flex shrink-0 items-center gap-2 text-sm font-medium tabular-nums',
                      waiting > 0 ? 'text-zinc-500 dark:text-zinc-400' : 'text-emerald-700 dark:text-emerald-400'
                    )}
                    aria-live="polite"
                  >
                    <Paintbrush className="size-4" aria-hidden="true" />
                    {pending !== null ? 'Painting…' : waiting > 0 ? `Next pixel in ${waiting}s` : 'Ready to paint'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-pretty text-zinc-600 dark:text-zinc-400">
                    You’re watching live. Sign in to add pixels of your own.
                  </p>
                  <div className="flex shrink-0 gap-2">
                    <Link href={paths.login} className={buttonClassName({ variant: 'secondary', size: 'sm' })}>
                      Sign in
                    </Link>
                    <Link href={paths.register} className={buttonClassName({ size: 'sm' })}>
                      Create account
                    </Link>
                  </div>
                </div>
              )}
              {typeof errors.pixel === 'string' ? (
                <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                  {errors.pixel}
                </p>
              ) : null}

              <PixelCanvas canvas={shown} color={color} canPaint={canPaint} zoom={zoom} onPaint={paint} onCursorChange={setCursor} />

              <div className="flex items-center justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                <span className="flex items-center gap-2 font-mono text-xs tabular-nums" aria-hidden="true">
                  {cursor === null || under === null ? (
                    'Point at a pixel'
                  ) : (
                    <>
                      <Swatch color={under} />
                      {cursor.x}, {cursor.y} · {palette[under]?.name}
                    </>
                  )}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Zoom out"
                    disabled={zoom <= 1}
                    className={buttonClassName({ variant: 'ghost', size: 'sm', className: 'size-8 px-0' })}
                    onClick={() => setZoom((current) => Math.max(1, current / 2))}
                  >
                    <Minus aria-hidden="true" />
                  </button>
                  <span className="w-8 text-center text-xs tabular-nums">{zoom}×</span>
                  <button
                    type="button"
                    aria-label="Zoom in"
                    disabled={zoom >= 4}
                    className={buttonClassName({ variant: 'ghost', size: 'sm', className: 'size-8 px-0' })}
                    onClick={() => setZoom((current) => Math.min(4, current * 2))}
                  >
                    <Plus aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-6">
            {props.you !== null ? (
              <section aria-label="You" className={cn(cardClassName, 'p-4')}>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">You’ve painted</p>
                <p className="mt-1 text-3xl font-semibold tabular-nums">
                  {props.you.painted} {props.you.painted === 1 ? 'pixel' : 'pixels'}
                </p>
              </section>
            ) : null}

            <section aria-labelledby="leaderboard-title" className={cardClassName}>
              <h2 id="leaderboard-title" className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
                Most pixels on the canvas
              </h2>
              {state.leaderboard.length === 0 ? (
                <p className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">Nobody yet. Be the first.</p>
              ) : (
                <ol className="flex flex-col gap-2.5 p-4">
                  {state.leaderboard.map((painter, index) => (
                    <li key={painter.name} className="flex items-center gap-3 text-sm">
                      <span className="w-4 text-right text-xs text-zinc-500 tabular-nums">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{painter.name}</span>
                      <span className="text-zinc-600 tabular-nums dark:text-zinc-400">{painter.pixels}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section aria-labelledby="recent-title" className={cardClassName}>
              <h2 id="recent-title" className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
                Just painted
              </h2>
              {state.recent.length === 0 ? (
                <p className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">The canvas is blank.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                  {state.recent.map((recent) => (
                    <li key={recent.id} className="flex items-center gap-2.5 px-4 py-2 text-sm">
                      <Swatch color={recent.color} className="size-4" />
                      <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                        <span className="truncate font-medium">{recent.name}</span>
                        <span className="shrink-0 font-mono text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
                          {recent.x}, {recent.y}
                        </span>
                      </span>
                      <time dateTime={recent.createdAt} className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                        {formatRelativeTime(recent.createdAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>

        <UnderTheHood route="POST /pixels" action="paint">
          <Guarantee>
            A trigger refuses a paint inside the cooldown, so two tabs, or two hundred requests, still get one pixel.
          </Guarantee>
          <Guarantee>
            The paint and the canvas change in one <code>dbBatch</code>: the trigger undoes both.
          </Guarantee>
          <Guarantee>
            The live view polls with the canvas’s version; <code>ifChanged</code> answers 304 until someone paints.
          </Guarantee>
        </UnderTheHood>
      </Layout>
    </>
  )
}

export default CanvasPage
