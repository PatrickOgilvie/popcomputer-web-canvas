import { action, render, RequireAuthLayer, RequireGuestLayer } from '@popcomputer/web/effect'
import { betterAuthLogoutAction } from '@popcomputer/web/auth'
import { joinIn } from './actions/auth'
import { canvasState, paint, showCanvas, showReplay } from './actions/canvas'
import { routes } from './app'
import { paths } from './paths'

// Nobody registers: joining in makes a guest to paint as.
routes
  .provide(RequireGuestLayer)
  .get(paths.login, action(render('Auth/Login')))
  .post(paths.login, joinIn)

// The canvas is everyone's to watch, so signing out goes back to it.
routes.post(paths.logout, betterAuthLogoutAction({ redirectTo: paths.canvas }))

// Anyone may watch the canvas and its replay; painting takes an account.
routes
  .get(paths.canvas, showCanvas)
  .get(paths.canvasState, canvasState)
  .get(paths.replay, showReplay)

routes
  .provide(RequireAuthLayer)
  .post(paths.pixels, paint, { form: paths.canvas })
