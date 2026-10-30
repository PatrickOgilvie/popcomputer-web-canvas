import type { D1Database, RateLimit } from '@cloudflare/workers-types'
import { Schema as S } from 'effect'
import { defineEnv, randomSecret, secret, variable, type EnvBindings } from '@popcomputer/web/env'

/**
 * The Worker's vars and secrets, each declared once. The Worker checks them
 * before it serves, `bun run env:check` checks them locally and on
 * Cloudflare, and `bun run deploy` won't deploy without them.
 */
export const env = defineEnv({
  /**
   * Signs sessions. `bun run dev` and the first deploy each make one;
   * replacing it signs everyone out.
   */
  BETTER_AUTH_SECRET: secret(S.String.check(S.isMinLength(32)), { generate: randomSecret }),
  /**
   * The address the app is served at, such as https://app.example.com:
   * Better Auth's baseURL, so nothing it builds, such as an emailed link,
   * follows the host a request arrived on. wrangler.jsonc names the live
   * address, `bun run dev` sets its own, and the tests theirs.
   */
  APP_URL: variable(
    S.String.check(
      S.isPattern(/^https?:\/\/[^/?#\s]+$/, {
        expected: 'an origin, such as https://app.example.com, with no path or trailing slash',
      })
    )
  ),
  /** `bun run dev` sets development, wrangler.jsonc production, and the tests test. */
  ENVIRONMENT: variable(S.Literals(['development', 'production', 'test'])),
})

/** The Worker's bindings: the vars and secrets above, and those wrangler.jsonc declares. */
export type Bindings = EnvBindings<typeof env> & {
  DB: D1Database
  SIGN_IN_LIMITER: RateLimit
}

export type Env = { Bindings: Bindings }
