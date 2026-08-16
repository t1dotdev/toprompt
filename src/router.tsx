import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    // Everywhere but a project page. That route is a transcript that owns its
    // own scroll position — it opens on the newest prompt and follows each one
    // added. Restoration fought it: every mutation calls router.invalidate(),
    // and the restore runs on `onRendered`, after the route's own scroll, so it
    // put the view back where it was before the prompt existed.
    scrollRestoration: ({ location }) => !location.pathname.startsWith('/p/'),
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
