// Every route's path, declared once: routes register on them, actions
// redirect to them and pages link to them with href.
export const paths = {
  canvas: '/',
  pixels: '/pixels',
  canvasState: '/canvas/state',
  replay: '/replay',
  login: '/login',
  logout: '/logout',
} as const
