import { createFileRoute, useLoaderData } from '@tanstack/react-router'
import { AppHeader } from '@/components/app-header'
import { Logo } from '@/components/logo'
import {
  NewProjectFab,
  NewProjectForm,
  ProjectList,
} from '@/components/project-list'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/user-menu'

export const Route = createFileRoute('/_authed/')({
  head: () => ({ meta: [{ title: 'Projects · toprompt' }] }),
  component: Projects,
})

function Projects() {
  const { user } = Route.useRouteContext()
  const projects = useLoaderData({ from: '/_authed' })

  return (
    <>
      {/* Phone width: the list is the page. From `md` up — where the sidebar
          appears — it lives there instead, and this pane says what to do with
          it. `div`, not `main`: SidebarInset is already the page's main.
          `relative` is the anchor the create button hangs off. */}
      <div className="relative flex min-h-0 flex-1 flex-col md:hidden">
        <AppHeader>
          <h1 className="flex flex-1 items-center gap-2 text-xl font-bold tracking-tight">
            <Logo size={20} />
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
          trigger, and this pane is one centred prompt with nothing to title. */}
      <div className="hidden min-h-0 flex-1 flex-col md:flex">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <Logo size={40} className="opacity-60" />
          <p className="text-sm text-muted-foreground">
            {projects.length === 0
              ? 'Name your first project to start a queue.'
              : 'Pick a project from the sidebar, or start a new one.'}
          </p>
          <NewProjectForm
            autoFocus
            submitLabel="Create"
            className="w-full max-w-xl"
          />
        </div>
      </div>
    </>
  )
}
