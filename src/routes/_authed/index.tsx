import { Link, createFileRoute, useLoaderData } from '@tanstack/react-router'
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
          <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pt-4 pb-24">
            <ProjectList projects={projects} />
          </div>
        </div>
        <NewProjectFab />
      </div>

      {/* No topbar here: the sidebar already owns the theme switch and its own
          trigger, and this pane is one centred start moment with nothing to
          title. */}
      <div className="hidden min-h-0 flex-1 flex-col md:flex">
        <div className="flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto px-6 py-10">
          <div className="flex flex-col items-center text-center">
            <Logo size={32} className="text-primary" />
            <h2 className="mt-4 text-2xl font-bold tracking-tight">
              {projects.length === 0
                ? 'Start your first queue'
                : 'Start a new queue'}
            </h2>
            <p className="mt-2 max-w-[38ch] text-balance text-sm text-muted-foreground">
              {projects.length === 0
                ? 'A project is one queue of prompts — usually one per codebase.'
                : 'Name it and start stashing — or pick up where you left off.'}
            </p>
          </div>

          <NewProjectForm
            autoFocus
            submitLabel="Create"
            className="w-full max-w-xl"
          />

          {/* The sidebar lists everything; this answers the narrower question —
              "the queue I was just in" — without a trip to the rail. Quiet
              outline chips, not cards: they are links, and three of them should
              weigh less than the form above. */}
          {recent.length > 0 && (
            <div className="flex flex-col items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">
                Jump back in
              </span>
              <div className="flex max-w-xl flex-wrap justify-center gap-2">
                {recent.map((p) => (
                  <Button
                    key={p.id}
                    variant="outline"
                    size="sm"
                    className="h-9 max-w-56"
                    render={
                      <Link to="/p/$projectId" params={{ projectId: p.id }} />
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
        </div>
      </div>
    </>
  )
}
