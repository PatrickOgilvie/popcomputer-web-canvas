// The canvas's size, how often a member may paint, and its colours: shared by
// the server, which checks them, and the pages, which draw with them.

/** The canvas is this many pixels across, and down. */
export const CANVAS_SIZE = 64

/**
 * How long a member waits between pixels. The trigger in
 * migrations/0001_paint_cooldown.sql holds the same number, in milliseconds.
 */
export const COOLDOWN_SECONDS = 10

/** The sixteen colours a pixel can be, by their index. 0 is the blank canvas. */
export const palette = [
  { name: 'White', hex: '#ffffff' },
  { name: 'Light grey', hex: '#e4e4e4' },
  { name: 'Grey', hex: '#888888' },
  { name: 'Black', hex: '#222222' },
  { name: 'Pink', hex: '#ffa7d1' },
  { name: 'Red', hex: '#e50000' },
  { name: 'Orange', hex: '#e59500' },
  { name: 'Brown', hex: '#a06a42' },
  { name: 'Yellow', hex: '#e5d900' },
  { name: 'Lime', hex: '#94e044' },
  { name: 'Green', hex: '#02be01' },
  { name: 'Cyan', hex: '#00d3dd' },
  { name: 'Blue', hex: '#0083c7' },
  { name: 'Indigo', hex: '#0000ea' },
  { name: 'Magenta', hex: '#cf6ee4' },
  { name: 'Purple', hex: '#820080' },
] as const

/**
 * The whole canvas as one string, a hex digit per pixel, row by row: 4,096
 * characters for a 64 by 64 canvas, small enough to send on every change.
 */
export function encodeCanvas(pixels: ReadonlyArray<{ readonly x: number; readonly y: number; readonly color: number }>): string {
  const cells = Array.from({ length: CANVAS_SIZE * CANVAS_SIZE }, () => '0')
  for (const pixel of pixels) cells[pixel.y * CANVAS_SIZE + pixel.x] = pixel.color.toString(16)
  return cells.join('')
}

/** One pixel's colour index in an encoded canvas. */
export function colorAt(canvas: string, x: number, y: number): number {
  return Number.parseInt(canvas[y * CANVAS_SIZE + x] ?? '0', 16)
}

/** The canvas with one pixel painted. */
export function withPixel(canvas: string, x: number, y: number, color: number): string {
  const index = y * CANVAS_SIZE + x
  return canvas.slice(0, index) + color.toString(16) + canvas.slice(index + 1)
}
