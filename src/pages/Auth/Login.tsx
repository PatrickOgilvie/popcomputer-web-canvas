import { Head, useForm, usePage } from '@inertiajs/react'
import type { FormEvent } from 'react'

import AuthShell from '~/components/AuthShell'
import { buttonClassName } from '~/components/button'
import { Guarantee } from '~/components/UnderTheHood'
import { paths } from '~/paths'

/** The way in: one button that makes the visitor a guest painter. */
export default function Login() {
  const { errors } = usePage().props
  const { post, processing } = useForm({})

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    post(paths.login)
  }

  return (
    <>
      <Head title="Join in" />
      <AuthShell
        title="Join in to paint"
        description="One click gives you a name to paint under, such as Curious Otter. No email, no password."
        footnote="Your pixels stay on the canvas, and in its replay."
        route="POST /login"
        action="joinIn"
        guarantees={
          <>
            <Guarantee>
              Better Auth’s anonymous plugin makes the guest, through its own handler, so the sign-in limits count it
              by address.
            </Guarantee>
            <Guarantee>Each guest has a cooldown of their own: the database holds it, per painter.</Guarantee>
          </>
        }
      >
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {typeof errors.form === 'string' ? (
            <p role="alert" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-pretty text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              {errors.form}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={processing}
            aria-busy={processing}
            className={buttonClassName({ className: 'h-11 w-full text-base' })}
          >
            <span aria-live="polite">{processing ? 'Joining…' : 'Join in to paint'}</span>
          </button>
        </form>
      </AuthShell>
    </>
  )
}
