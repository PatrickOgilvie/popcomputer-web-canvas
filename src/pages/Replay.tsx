import { Head, Link } from '@inertiajs/react'
import type { WebPage } from '@popcomputer/web/react'
import { ArrowLeft, Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { CANVAS_SIZE, palette } from '~/canvas'
import { buttonClassName } from '~/components/button'
import { cn } from '~/components/cn'
import Layout from '~/components/Layout'
import PageHeader from '~/components/PageHeader'
import { paths } from '~/paths'

/** A replay at 1× lasts about this long, however many pixels there are. */
const REPLAY_MS = 12_000
const speeds = [1, 2, 4] as const

/** The canvas's whole history, painted again pixel by pixel. */
const Replay: WebPage<'Replay'> = ({ paints, painters }) => {
  const total = paints.length / 3
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawn = useRef(0)
  const [shown, setShown] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<(typeof speeds)[number]>(1)

  // Draws paints [from, to) on top of what's there; drawing from 0 starts blank.
  function drawUpTo(to: number) {
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    if (to < drawn.current) {
      context.fillStyle = palette[0].hex
      context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      drawn.current = 0
    }
    for (let index = drawn.current; index < to; index += 1) {
      context.fillStyle = palette[paints[index * 3 + 2] ?? 0]?.hex ?? palette[0].hex
      context.fillRect(paints[index * 3] ?? 0, paints[index * 3 + 1] ?? 0, 1, 1)
    }
    drawn.current = to
    setShown(to)
  }

  // Starts blank and plays, unless the visitor prefers less motion: then it
  // shows the canvas as it is now, to play when they choose.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    drawUpTo(reduced ? total : 0)
    setPlaying(!reduced && total > 0)
    // Once, on arrival.
  }, [])

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const perMs = (total / REPLAY_MS) * speed

    function step(now: number) {
      const next = Math.min(total, drawn.current + Math.max(1, Math.round((now - last) * perMs)))
      last = now
      drawUpTo(next)
      if (next >= total) setPlaying(false)
      else frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
    // drawUpTo reads refs, so it needn't be a dependency.
  }, [playing, speed, total])

  function togglePlay() {
    if (shown >= total) drawUpTo(0)
    setPlaying((current) => !current)
  }

  return (
    <>
      <Head title="Replay" />
      <Layout>
        <PageHeader
          title="Replay"
          breadcrumbs={[{ label: 'Canvas', href: paths.canvas }, { label: 'Replay' }]}
          description={`Every pixel, in the order it was painted: ${total.toLocaleString()} ${total === 1 ? 'pixel' : 'pixels'} by ${painters} ${painters === 1 ? 'painter' : 'painters'}.`}
          actions={
            <Link href={paths.canvas} className={buttonClassName({ variant: 'secondary' })}>
              <ArrowLeft aria-hidden="true" />
              Back to live
            </Link>
          }
        />

        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800">
            <canvas
              ref={canvasRef}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="block aspect-square w-full [image-rendering:pixelated]"
              role="img"
              aria-label={`The canvas after ${shown} of ${total} pixels`}
            />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
            <label className="flex flex-col gap-2 text-sm">
              <span className="flex justify-between text-zinc-600 tabular-nums dark:text-zinc-400">
                <span>Pixel {shown.toLocaleString()}</span>
                <span>{total.toLocaleString()}</span>
              </span>
              <input
                type="range"
                min={0}
                max={total}
                value={shown}
                disabled={total === 0}
                className="w-full accent-orange-600"
                aria-label="Position in the replay"
                onChange={(event) => {
                  setPlaying(false)
                  drawUpTo(Number(event.target.value))
                }}
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <button type="button" disabled={total === 0} className={buttonClassName()} onClick={togglePlay}>
                  {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                  {playing ? 'Pause' : shown >= total ? 'Play again' : 'Play'}
                </button>
                <button
                  type="button"
                  disabled={total === 0}
                  className={buttonClassName({ variant: 'secondary' })}
                  onClick={() => {
                    drawUpTo(0)
                    setPlaying(true)
                  }}
                >
                  <RotateCcw aria-hidden="true" />
                  Restart
                </button>
              </div>
              <fieldset className="flex items-center gap-1 rounded-md bg-zinc-100 p-1 dark:bg-zinc-800">
                <legend className="sr-only">Speed</legend>
                {speeds.map((option) => (
                  <label
                    key={option}
                    className={cn(
                      'flex h-7 cursor-pointer items-center rounded px-2.5 text-sm font-medium text-zinc-600 tabular-nums has-checked:bg-white has-checked:text-zinc-950 has-checked:shadow-xs has-focus-visible:outline-2 has-focus-visible:outline-orange-600 dark:text-zinc-400 dark:has-checked:bg-zinc-950 dark:has-checked:text-white'
                    )}
                  >
                    <input
                      type="radio"
                      name="speed"
                      className="sr-only"
                      checked={speed === option}
                      onChange={() => setSpeed(option)}
                    />
                    {option}×
                  </label>
                ))}
              </fieldset>
            </div>
          </div>
        </div>
      </Layout>
    </>
  )
}

export default Replay
