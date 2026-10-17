// Every route's path, declared once: routes register on them, actions
// redirect to them and pages link to them with href.
export const paths = {
  canvas: '/',
  pixels: '/pixels',
  canvasState: '/canvas/state',
  replay: '/replay',
  login: '/login',
  register: '/register',
  logout: '/logout',
  sessions: '/sessions',
  otherSessions: '/sessions/others',
  session: '/sessions/{session}',
} as const
