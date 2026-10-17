import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'

import { CANVAS_SIZE, colorAt, palette } from '~/canvas'
import { cn } from '~/components/cn'

const rgb = palette.map(({ hex }) => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
])

/** Draws an encoded canvas onto a 64 by 64 `<canvas>`, one image at a time. */
export function drawCanvas(context: CanvasRenderingContext2D, canvas: string) {
  const image = context.createImageData(CANVAS_SIZE, CANVAS_SIZE)
  for (let index = 0; index < CANVAS_SIZE * CANVAS_SIZE; index += 1) {
    const [red, green, blue] = rgb[Number.parseInt(canvas[index] ?? '0', 16)] ?? [255, 255, 255]
    image.data[index * 4] = red ?? 255
    image.data[index * 4 + 1] = green ?? 255
    image.data[index * 4 + 2] = blue ?? 255
    image.data[index * 4 + 3] = 255
  }
  context.putImageData(image, 0, 0)
}

export interface Cell {
  readonly x: number
  readonly y: number
}

const clamp = (value: number) => Math.min(CANVAS_SIZE - 1, Math.max(0, value))

interface PixelCanvasProps {
  readonly canvas: string
  /** The colour a paint would use, previewed under the cursor. */
  readonly color: number
  /** Whether a click paints now; otherwise the cursor still moves. */
  readonly canPaint: boolean
  readonly zoom: number
  readonly onPaint: (cell: Cell) => void
  /** The pixel under the cursor, or null once it leaves the canvas. */
  readonly onCursorChange?: (cell: Cell | null) => void
}

/**
 * The canvas, scaled up with crisp pixels. A mouse paints where it clicks; a
 * touch first picks a pixel, then paints it on a second tap; the keyboard
 * moves a cursor with the arrow keys and paints with Enter or Space.
 */
export default function PixelCanvas({ canvas, color, canPaint, zoom, onPaint, onCursorChange }: PixelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [cursor, setCursor] = useState<Cell>({ x: CANVAS_SIZE / 2, y: CANVAS_SIZE / 2 })
  const [showsCursor, setShowsCursor] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => onCursorChange?.(showsCursor ? cursor : null), [cursor, showsCursor, onCursorChange])

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d')
    if (context) drawCanvas(context, canvas)
  }, [canvas])

  function cellAt(event: PointerEvent<HTMLElement>): Cell | undefined {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect === undefined || rect.width === 0) return undefined
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * CANVAS_SIZE)
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * CANVAS_SIZE)
    if (x < 0 || y < 0 || x >= CANVAS_SIZE || y >= CANVAS_SIZE) return undefined
    return { x, y }
  }

  function describe(cell: Cell) {
    const current = palette[colorAt(canvas, cell.x, cell.y)]?.name ?? 'White'
    return `${cell.x}, ${cell.y}: ${current}`
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const cell = cellAt(event)
    if (cell === undefined) return
    const sameCell = showsCursor && cell.x === cursor.x && cell.y === cursor.y
    setCursor(cell)
    setShowsCursor(true)
    // A touch picks first, so scrolling a zoomed canvas never paints by accident.
    if (event.pointerType === 'mouse' || sameCell) onPaint(cell)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 8 : 1
    const moves: Record<string, Cell> = {
      ArrowLeft: { x: clamp(cursor.x - step), y: cursor.y },
      ArrowRight: { x: clamp(cursor.x + step), y: cursor.y },
      ArrowUp: { x: cursor.x, y: clamp(cursor.y - step) },
      ArrowDown: { x: cursor.x, y: clamp(cursor.y + step) },
    }
    const next = moves[event.key]
    if (next !== undefined) {
      event.preventDefault()
      setCursor(next)
      setShowsCursor(true)
      setAnnouncement(describe(next))
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setShowsCursor(true)
      onPaint(cursor)
    }
  }

  const swatch = palette[color]?.hex ?? '#ffffff'

  return (
    <div className="relative overflow-auto rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
      <div
        role="application"
        aria-roledescription="pixel canvas"
        aria-label={`Canvas, ${CANVAS_SIZE} by ${CANVAS_SIZE} pixels. Arrow keys move the cursor, Shift moves eight at a time, Enter paints.`}
        tabIndex={0}
        className={cn(
          'relative aspect-square touch-manipulation outline-none select-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-inset',
          canPaint ? 'cursor-crosshair' : 'cursor-not-allowed'
        )}
        style={{ width: `${zoom * 100}%` }}
        onPointerMove={(event) => {
          if (event.pointerType !== 'mouse') return
          const cell = cellAt(event)
          if (cell === undefined) return
          setCursor(cell)
          setShowsCursor(true)
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') setShowsCursor(false)
        }}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        onFocus={() => setAnnouncement(describe(cursor))}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="block size-full [image-rendering:pixelated]"
          aria-hidden="true"
        />
        {showsCursor ? (
          <div
            className="pointer-events-none absolute ring-2 ring-zinc-950 ring-offset-1 ring-offset-white dark:ring-offset-zinc-950"
            style={{
              left: `${(cursor.x / CANVAS_SIZE) * 100}%`,
              top: `${(cursor.y / CANVAS_SIZE) * 100}%`,
              width: `${100 / CANVAS_SIZE}%`,
              height: `${100 / CANVAS_SIZE}%`,
              backgroundColor: canPaint ? swatch : 'transparent',
              opacity: canPaint ? 0.85 : 1,
            }}
            aria-hidden="true"
          />
        ) : null}
      </div>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  )
}
