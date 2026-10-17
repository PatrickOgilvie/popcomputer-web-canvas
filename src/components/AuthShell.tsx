import { Link } from '@inertiajs/react'
import { Clapperboard, Grid3x3, Timer } from 'lucide-react'
import type { ReactNode } from 'react'

import Brand from '~/components/Brand'
import UnderTheHood, { Guarantee } from '~/components/UnderTheHood'
import usePageTransitionFocus from '~/components/usePageTransitionFocus'

interface AuthShellProps {
  readonly title: string
  readonly description: string
  readonly alternatePrompt: string
  readonly alternateHref: string
  readonly alternateLabel: string
  readonly route: string
  readonly action: string
  readonly children: ReactNode
}

const tour = [
  {
    icon: Grid3x3,
    title: 'One shared canvas',
    description: 'Pick a colour and paint a pixel. Everyone watching sees it appear within a couple of seconds.',
  },
  {
    icon: Timer,
    title: 'A pixel every 10 seconds',
    description: 'The database itself holds the cooldown, so a second tab can’t get around it.',
  },
  {
    icon: Clapperboard,
    title: 'A time-lapse',
    description: 'Replay the canvas from blank, every pixel in the order it was painted.',
  },
] as const

/** Shared, responsive frame for the sign-in and registration journeys. */
export default function AuthShell({
  title,
  description,
  alternatePrompt,
  alternateHref,
  alternateLabel,
  route,
  action,
  children,
}: AuthShellProps) {
  const { mainRef, announcement } = usePageTransitionFocus()

  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,32rem)]">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-white px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:top-3 focus:left-3 dark:bg-zinc-900"
      >
        Skip to content
      </a>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>

      <main
        ref={mainRef}
        id="main-content"
        tabIndex={-1}
        className="flex flex-col bg-white px-4 py-8 focus:outline-none sm:px-8 dark:bg-zinc-950"
      >
        <Brand />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-2xl font-semibold text-balance">{title}</h1>
          <p className="mt-2 text-sm text-pretty text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
            {alternatePrompt}{' '}
            <Link
              href={alternateHref}
              className="rounded-sm font-medium text-zinc-950 underline underline-offset-4 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-orange-600 dark:text-white dark:hover:text-zinc-300"
            >
              {alternateLabel}
            </Link>
          </p>
        </div>
      </main>

      <aside
        aria-labelledby="demo-tour-title"
        className="hidden flex-col justify-center gap-10 border-l border-zinc-200 bg-zinc-50 px-10 py-12 lg:flex dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            A @popcomputer/web example
          </p>
          <h2 id="demo-tour-title" className="mt-2 text-xl font-semibold text-balance">
            What you can try once you’re in
          </h2>
        </div>
        <ul className="flex flex-col gap-6">
          {tour.map((stop) => (
            <li key={stop.title} className="flex gap-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
                <stop.icon className="size-4 text-zinc-700 dark:text-zinc-300" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-sm font-medium">{stop.title}</h3>
                <p className="mt-1 text-sm text-pretty text-zinc-600 dark:text-zinc-400">
                  {stop.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <UnderTheHood route={route} action={action} compact>
          <Guarantee>
            The form is validated by its schema in <code className="font-mono text-xs">src/forms.ts</code>, then
            sent through Better Auth’s own handler; browsers can’t reach{' '}
            <code className="font-mono text-xs">/api/auth/*</code>.
          </Guarantee>
          <Guarantee>
            Attempts are limited per address by Cloudflare’s Rate Limiting binding, and per account in D1.
          </Guarantee>
        </UnderTheHood>
      </aside>
    </div>
  )
}
