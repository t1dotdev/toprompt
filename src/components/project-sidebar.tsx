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
  SidebarRail,
  SidebarTrigger,
  useSidebar,
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
  const { state, isMobile, toggleSidebar } = useSidebar()
  // The rail is a desktop shape only: on a phone the sidebar is a sheet that is
  // either open at full width or not on screen at all.
  const collapsed = state === 'collapsed' && !isMobile

  return (
    <Sidebar
      collapsible="icon"
      // Collapsed, the whole strip is the handle, not just its 16px edge: the
      // resize cursor rides on inheritance, so the controls keep their own
      // pointer, and a click that missed one widens the sidebar back.
      className={collapsed ? 'cursor-e-resize' : undefined}
      onClick={
        collapsed
          ? (e) => {
              const target = e.target as HTMLElement
              // The rail's popups are portalled to the body, but React bubbles
              // their clicks through this tree anyway. Without this the sidebar
              // widened out from under every menu item picked in one of them —
              // and the row that was about to become a rename field went with
              // it. A DOM containment check is what tells the two apart.
              if (!e.currentTarget.contains(target)) return
              if (!target.closest('a,button')) toggleSidebar()
            }
          : undefined
      }
    >
      {/* Collapsed, the header's own gap is what sets the mark apart from the
          controls under it — 16px against the 8px rhythm the icons keep among
          themselves. */}
      <SidebarHeader className={collapsed ? 'gap-4' : undefined}>
        {collapsed ? (
          // The mark holds the slot until you point at it, then hands it to the
          // control that brings the sidebar back — one 32px square, two jobs.
          <div className="group/brand relative flex h-8 items-center justify-center">
            <Logo
              size={24}
              className="text-primary transition-opacity group-hover/brand:opacity-0"
            />
            {/* cursor-e-resize, not the button default: this slot is part of the
                strip that widens on click, and one cursor across all of it says
                so. */}
            <SidebarTrigger className="absolute inset-0 m-auto size-8 cursor-e-resize text-sidebar-foreground/60 opacity-0 transition-opacity group-hover/brand:opacity-100 focus-visible:opacity-100" />
          </div>
        ) : (
          /* The wordmark is the app's identity, not a row of the switcher, so it
             is a plain link — outside the menu the logo also keeps its own size
             instead of the menu button's `[&_svg]:size-4`. */
          <div className="flex items-center gap-2 px-2 py-1">
            <Link to="/" className="flex min-w-0 flex-1 items-center gap-2">
              <Logo size={28} className="text-primary" />
              <span className="truncate text-base font-bold tracking-tight">
                toprompt
              </span>
            </Link>
            {/* No gap inside the pair: two 36px buttons already carry 10px of
                their own padding each, so the row's gap-2 on top of that put 28px
                between the glyphs and read as two unrelated controls. The gap
                stays between the wordmark and the pair, where it separates
                identity from controls. Both quiet at the same weight for the
                same reason. */}
            <div className="flex shrink-0 items-center">
              <ThemeToggle className="size-8 text-sidebar-foreground/60" />
              <SidebarTrigger className="size-8 text-sidebar-foreground/60" />
            </div>
          </div>
        )}

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
              tooltip="New project"
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
      {/* pt-0 while collapsed: the header already paid 8px below the last icon,
          and a second one would break the rhythm at the seam. */}
      <SidebarContent className={collapsed ? 'p-2 pt-0' : 'p-2'}>
        <ProjectList projects={projects} sidebar />
      </SidebarContent>

      {/* gap-2 collapsed: the rail keeps one 8px step between every icon, and
          the footer is part of that column. */}
      <SidebarFooter>
        <SidebarMenu className={collapsed ? 'gap-2' : undefined}>
          {/* The rail has no room beside the trigger for the switch it sits
              next to when the sidebar is open, so it moves to the foot of the
              column instead of off the sidebar altogether — the topbar stopped
              carrying one at this width. */}
          {collapsed && (
            <SidebarMenuItem className="flex justify-center">
              <ThemeToggle className="size-8 text-sidebar-foreground/60" />
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <UserMenu user={user} variant="full" />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {/* The edge is a handle: resize cursor on hover, click to widen or narrow.
          Its hairline also answers a hover anywhere on the collapsed strip, so
          the whole rail shows where the click will land. */}
      <SidebarRail className="group-data-[collapsible=icon]:group-hover:after:bg-sidebar-border" />
    </Sidebar>
  )
}
