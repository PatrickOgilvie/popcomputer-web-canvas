import { action, render, RequireAuthLayer, RequireGuestLayer } from '@popcomputer/web/effect'
import { betterAuthLogoutAction } from '@popcomputer/web/auth'
import { signIn, signUp } from './actions/auth'
import { canvasState, paint, showCanvas, showReplay } from './actions/canvas'
import { listSessions, revokeOtherSessions, revokeSession } from './actions/sessions'
import { routes } from './app'
import { paths } from './paths'

routes
  .provide(RequireGuestLayer)
  .get(paths.login, action(render('Auth/Login')))
  .post(paths.login, signIn)
  .get(paths.register, action(render('Auth/Register')))
  .post(paths.register, signUp)

routes.post(paths.logout, betterAuthLogoutAction({ redirectTo: paths.login }))

// Anyone may watch the canvas and its replay; painting takes an account.
routes
  .get(paths.canvas, showCanvas)
  .get(paths.canvasState, canvasState)
  .get(paths.replay, showReplay)

routes
  .provide(RequireAuthLayer)
  .post(paths.pixels, paint, { form: paths.canvas })
  .get(paths.sessions, listSessions)
  .delete(paths.otherSessions, revokeOtherSessions)
  .delete(paths.session, revokeSession, { form: paths.sessions })
