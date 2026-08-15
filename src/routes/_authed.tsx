import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
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

function AuthedLayout() {
  const { user } = Route.useRouteContext()
  const projects = Route.useLoaderData()

  // h-dvh over the provider's own min-h-svh: the shell owns the viewport height
  // so the sidebar and the page next to it scroll independently instead of
  // dragging one long document. 18rem because a project row carries a drag
  // handle and an actions button either side of its name.
  return (
    <SidebarProvider
      className="h-dvh"
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
