import { Link, useMatchRoute } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon } from '@hugeicons/core-free-icons'
import { Logo } from '@/components/logo'
import { ProjectList } from '@/components/project-list'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/user-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import type { ProjectSummary } from '@/lib/fns'

/**
 * Below the sidebar's breakpoint the project list *is* the home screen, so a
 * second copy of it would only compete with the page it navigates to; the
 * sidebar exists because a wide window has room to keep the queue switcher
 * visible while a queue is open.
 */
export function ProjectSidebar({
  projects,
  user,
}: {
  projects: Array<ProjectSummary>
  user: { name: string; email: string; image?: string | null }
}) {
  const matchRoute = useMatchRoute()

  return (
    <Sidebar>
      <SidebarHeader>
        {/* The wordmark is the app's identity, not a row of the switcher, so it
            is a plain link — outside the menu the logo also keeps its own size
            instead of the menu button's `[&_svg]:size-4`. */}
        <div className="flex items-center gap-2 px-2 py-1">
          <Link to="/" className="flex min-w-0 flex-1 items-center gap-2">
            <Logo size={24} />
            <span className="truncate text-base font-bold tracking-tight">
              toprompt
            </span>
          </Link>
          <ThemeToggle className="size-9 shrink-0" />
        </div>

        <SidebarMenu>
          {/* Creating happens on the home pane, not here — the sidebar stays a
              switcher, so naming a project can't cost someone the prompt they
              are halfway through writing next to it. */}
          <SidebarMenuItem>
            {/* matchRoute rather than the link's own data-status: `/` prefixes
                every route, so the link would read as active inside a project
                too. */}
            <SidebarMenuButton
              isActive={!!matchRoute({ to: '/' })}
              render={<Link to="/" />}
            >
              <HugeiconsIcon icon={Add01Icon} />
              <span>New project</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* No group wrapper here: the list emits its own Pinned / Projects
          groups, and pinning has to be able to move a row between them. */}
      <SidebarContent className="p-2">
        <ProjectList projects={projects} flat />
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <UserMenu user={user} variant="full" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
