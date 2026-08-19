import { Link, createFileRoute, useLoaderData } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Folder01Icon } from '@hugeicons/core-free-icons'
import { AppHeader } from '@/components/app-header'
import { Logo } from '@/components/logo'
import {
  NewProjectFab,
  NewProjectForm,
  ProjectList,
} from '@/components/project-list'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/user-menu'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

export const Route = createFileRoute('/_authed/')({
  head: () => ({ meta: [{ title: 'Projects · toprompt' }] }),
  component: Projects,
})

function Projects() {
  const { user } = Route.useRouteContext()
  const projects = useLoaderData({ from: '/_authed' })
  // The server orders by recency, so the first rows are the queues most likely
  // to be the reason this tab was opened.
  const recent = projects.slice(0, 3)

  return (
    <>
      {/* Phone width: the list is the page. From `md` up — where the sidebar
          appears — it lives there instead, and this pane says what to do with
          it. `div`, not `main`: SidebarInset is already the page's main.
          `relative` is the anchor the create button hangs off. */}
      <div className="relative flex min-h-0 flex-1 flex-col md:hidden">
        <AppHeader>
          <h1 className="flex flex-1 items-center gap-2 text-xl font-bold tracking-tight">
            <Logo size={20} className="text-primary" />
            toprompt
          </h1>
          <ThemeToggle />
          <UserMenu user={user} />
        </AppHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* pb-24 is the button's lane: the last row in the list has to be
              readable and tappable with it sitting in the corner. */}
          <div className="mx-auto max-w-md px-4 pt-4 pb-24">
            <ProjectList projects={projects} />
          </div>
        </div>
        <NewProjectFab />
      </div>

      {/* No topbar here: the sidebar already owns the theme switch and its own
          trigger, and this pane is one centred start moment with nothing to
          title. */}
      <div className="hidden min-h-0 flex-1 flex-col md:flex">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={Folder01Icon} />
              </EmptyMedia>
              <EmptyTitle>
                {projects.length === 0
                  ? 'Start your first queue'
                  : 'Start a new queue'}
              </EmptyTitle>
              <EmptyDescription>
                {projects.length === 0
                  ? 'A project is one queue of prompts — usually one per codebase.'
                  : 'Name it and start stashing — or pick up where you left off.'}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="max-w-xl">
              <NewProjectForm autoFocus className="w-full" />

              {/* The sidebar lists everything; this answers the narrower
                  question — "the queue I was just in" — without a trip to the
                  rail. */}
              {recent.length > 0 && (
                <div className="flex flex-col items-center gap-3">
                  <span className="text-xs font-medium text-muted-foreground">
                    Jump back in
                  </span>
                  <div className="flex flex-wrap justify-center gap-2">
                    {recent.map((p) => (
                      <Button
                        key={p.id}
                        variant="outline"
                        size="sm"
                        className="max-w-56"
                        render={
                          <Link
                            to="/p/$projectId"
                            params={{ projectId: p.id }}
                          />
                        }
                      >
                        <span className="truncate">{p.name}</span>
                        {p.open > 0 && (
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {p.open}
                          </span>
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </EmptyContent>
          </Empty>
        </div>
      </div>
    </>
  )
}
