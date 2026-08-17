import { useEffect, useRef } from 'react'
import {
  Outlet,
  createFileRoute,
  redirect,
  useRouter,
} from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Alert02Icon, RefreshIcon } from '@hugeicons/core-free-icons'
import { ProjectSidebar } from '@/components/project-sidebar'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { Spinner } from '@/components/ui/spinner'
import { getSessionFn, listProjectsFn } from '@/lib/fns'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session) throw redirect({ to: '/login' })
    return { user: session.user }
  },
  // Lives here rather than on the index route because the desktop sidebar shows
  // the same list from every authed page, and one loader means one fetch.
  loader: () => listProjectsFn(),
  pendingComponent: AuthedPending,
  errorComponent: AuthedError,
  component: AuthedLayout,
})

// Long enough that flicking between two apps does not refetch on every return,
// short enough that a queue left open since this morning is not what you come
// back to.
const REFETCH_AFTER_MS = 10_000

/**
 * Refetches the loaders when the app comes back to the foreground.
 *
 * The queue is server state with no realtime channel, so the only thing that
 * has ever refreshed it is a page load — and installed to a home screen there
 * is no reload button to press, no address bar to re-enter, and (since the
 * shell went `fixed`) no pull-to-refresh to pull. Coming back from another app
 * is the moment the list is most likely stale and the moment the user is least
 * able to say so.
 */
function useRefetchOnReturn() {
  const router = useRouter()
  const refetched = useRef(0)

  useEffect(() => {
    refetched.current = Date.now()
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - refetched.current < REFETCH_AFTER_MS) return
      refetched.current = Date.now()
      router.invalidate()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [router])
}

function AuthedLayout() {
  const { user } = Route.useRouteContext()
  const projects = Route.useLoaderData()

  useRefetchOnReturn()

  // h-dvh over the provider's own min-h-svh: the shell owns the viewport height
  // so the sidebar and the page next to it scroll independently instead of
  // dragging one long document. 18rem because a project row carries a pin and
  // an actions button to the right of its name.
  //
  // fixed, because h-dvh alone is a promise the browser does not always keep —
  // a phone mid-toolbar-animation, a soft keyboard, anything that leaves the
  // shell taller than the viewport hands the scroll back to the document. That
  // is not a cosmetic difference: SidebarInset clips its overflow, and a
  // `sticky` topbar inside a clipped box sticks to the box, so the moment the
  // document is what scrolls, the topbar scrolls away with it. Out of flow
  // there is nothing left for the document to scroll.
  return (
    <SidebarProvider
      className="fixed inset-0 h-dvh"
      style={{ '--sidebar-width': '18rem' } as React.CSSProperties}
    >
      <ProjectSidebar projects={projects} user={user} />
      <SidebarInset className="min-h-0 min-w-0 overflow-hidden">
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  )
}

function AuthedPending() {
  return (
    <div className="flex h-dvh items-center justify-center">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  )
}

function AuthedError({ reset }: { reset: () => void }) {
  return (
    <div className="flex h-dvh items-center justify-center px-4">
      <Empty className="max-w-md border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={Alert02Icon} />
          </EmptyMedia>
          <EmptyTitle>Couldn't load your projects</EmptyTitle>
          <EmptyDescription>
            The connection dropped or the server is down. Nothing was lost.
          </EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" onClick={reset} className="h-11">
          <HugeiconsIcon icon={RefreshIcon} />
          Try again
        </Button>
      </Empty>
    </div>
  )
}
