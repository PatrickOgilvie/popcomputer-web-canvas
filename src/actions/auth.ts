import { Effect } from 'effect'
import { action, intendedUrl, invalid } from '@popcomputer/web/effect'
import { betterAuthRedirect } from '@popcomputer/web/auth'
import { paths } from '../paths'

/**
 * Joins in: signs the visitor in as a guest of their own, through Better
 * Auth's anonymous plugin, and sends them back to the canvas. A guest is a
 * sign-in like any other, so the sign-in limits count it by address.
 */
export const joinIn = action(
  Effect.gen(function* () {
    return yield* betterAuthRedirect('signInAnonymous', {}, { redirectTo: yield* intendedUrl(paths.canvas) })
  }).pipe(
    Effect.catchTag('AuthRateLimitError', (error) =>
      invalid({ form: `Lots of painters have joined from here just now. Try again in ${error.retryAfterSeconds ?? 60} seconds.` })
    )
  )
)
