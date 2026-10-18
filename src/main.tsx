import './styles.css'
import { createInertiaApp } from '@inertiajs/react'
import type { PageName } from '@popcomputer/web/effect'
import type { WebPage } from '@popcomputer/web/react'
import { createRoot } from 'react-dom/client'
import Login from './pages/Auth/Login'
import Canvas from './pages/Canvas'
import ErrorPage from './pages/Errors/Error'
import Replay from './pages/Replay'
import { appTitle } from './title'

// Every registered page's component: a page without one is a type error.
const components: { readonly [Name in PageName]: WebPage<Name> } = {
  'Auth/Login': Login,
  Canvas,
  Replay,
}

const isPage = (name: string): name is PageName => name in components

void createInertiaApp({
  title: (title) => (title ? `${title} · ${appTitle}` : appTitle),
  // The error page is not a registered page: it answers any other name.
  resolve: (name) => (isPage(name) ? components[name] : ErrorPage),
  setup({ el, App, props }) {
    if (el !== null) createRoot(el).render(<App {...props} />)
  },
})
