import { useRef, useState } from 'react'
import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Delete02Icon,
  Folder01Icon,
  MoreHorizontalIcon,
  PinIcon,
  PinOffIcon,
} from '@hugeicons/core-free-icons'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { useMutate, useOptimisticList } from '@/lib/use-mutate'
import {
  type ProjectSummary,
  createProjectFn,
  deleteProjectFn,
  setProjectPinnedFn,
} from '@/lib/fns'

type ProjectAction =
  | { type: 'remove'; id: string }
  | { type: 'pin'; id: string; pinned: boolean }

function applyProjectAction(
  projects: Array<ProjectSummary>,
  action: ProjectAction,
): Array<ProjectSummary> {
  switch (action.type) {
    case 'remove':
      return projects.filter((p) => p.id !== action.id)
    case 'pin':
      // Grouping is derived from this flag at render, so flipping it is all it
      // takes for the row to jump groups on the same frame as the click.
      return projects.map((p) =>
        p.id === action.id ? { ...p, pinned: action.pinned } : p,
      )
  }
}

/**
 * Name-and-submit. Lands the user in the queue it just made — the only reason
 * to name a project is to start filling it.
 */
export function NewProjectForm({
  submitLabel,
  autoFocus,
  className,
}: {
  /** Present ⇒ a tall pill with the labelled button sitting inside the field;
   *  absent ⇒ the compact input and icon button side by side. */
  submitLabel?: string
  autoFocus?: boolean
  className?: string
}) {
  const navigate = useNavigate()
  const [saving, save] = useMutate()
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const trimmed = name.trim()

  function create() {
    if (!trimmed || saving) return
    setName('')
    // Keeps focus in the field so several projects can be added in a row.
    inputRef.current?.focus()
    save(() => createProjectFn({ data: { name: trimmed } }), {
      error: `Couldn't create “${trimmed}”.`,
      onError: () => setName(trimmed),
      onSuccess: ({ id }) =>
        navigate({ to: '/p/$projectId', params: { projectId: id } }),
    })
  }

  return (
    <form
      className={cn(submitLabel ? 'relative' : 'flex gap-2', className)}
      onSubmit={(e) => {
        e.preventDefault()
        create()
      }}
    >
      <Input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New project"
        aria-label="New project name"
        maxLength={200}
        autoComplete="off"
        enterKeyHint="done"
        autoFocus={autoFocus}
        // pr-32 is the button's width plus its inset — without it a long name
        // types straight under the button.
        className={cn('h-11', submitLabel && 'h-13 pr-32 pl-5 md:text-base')}
      />
      <Button
        type="submit"
        size={submitLabel ? undefined : 'icon'}
        className={cn(
          'h-11',
          submitLabel ? 'absolute inset-y-1.5 right-1.5 h-auto px-4' : 'size-11',
        )}
        disabled={!trimmed || saving}
        aria-label={submitLabel ? undefined : 'Add project'}
      >
        {saving ? <Spinner /> : <HugeiconsIcon icon={Add01Icon} />}
        {submitLabel}
      </Button>
    </form>
  )
}

/**
 * Most recently worked-in project first — the server orders it, this only
 * renders it. Shared by the phone-width home screen and by the desktop
 * sidebar — one is hidden at any width, so each mount owning its own
 * optimistic state is fine.
 */
export function ProjectList({
  projects: loaded,
  flat,
}: {
  projects: Array<ProjectSummary>
  /** Sidebar rows: plain hoverable lines instead of outlined cards. The home
   *  pane keeps the cards — it has no hover to lean on and the list is the
   *  whole page there. */
  flat?: boolean
}) {
  const [, mutate] = useMutate()
  const navigate = useNavigate()
  const matchRoute = useMatchRoute()
  const [projects, addOptimistic] = useOptimisticList(loaded, applyProjectAction)
  const { state, isMobile } = useSidebar()
  // Only the sidebar copy can be collapsed — the home pane renders below the
  // breakpoint, where the sidebar is a full-width sheet.
  const collapsed = !!flat && state === 'collapsed' && !isMobile

  const pinned = projects.filter((p) => p.pinned)
  const rest = projects.filter((p) => !p.pinned)

  if (collapsed)
    return (
      // gap-2, not the menu default gap-1: the rail keeps one 8px step between
      // every icon, including across the header seam above it.
      <SidebarMenu className="gap-2">
        {railGroup('Pinned', PinIcon, pinned)}
        {railGroup('Projects', Folder01Icon, rest)}
      </SidebarMenu>
    )

  if (projects.length === 0)
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={Folder01Icon} />
          </EmptyMedia>
          <EmptyTitle>No projects yet</EmptyTitle>
          <EmptyDescription>
            A project is one queue of prompts — usually one per codebase.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )

  function group(label: string, rows: Array<ProjectSummary>) {
    if (rows.length === 0) return null
    return (
      <SidebarGroup className="p-0">
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          {/* gap-2, not the menu default gap-1: outlined rows carry their own
              border, and 4px between two of them reads as a squeeze. Flat rows
              have no border to crowd, so the default gap is right. */}
          <SidebarMenu className={cn(!flat && 'gap-2')}>
            {rows.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                flat={flat}
                onTogglePin={() =>
                  mutate(
                    () =>
                      setProjectPinnedFn({
                        data: { id: p.id, pinned: !p.pinned },
                      }),
                    {
                      error: `Couldn't ${p.pinned ? 'unpin' : 'pin'} “${p.name}”.`,
                      optimistic: () =>
                        addOptimistic({
                          type: 'pin',
                          id: p.id,
                          pinned: !p.pinned,
                        }),
                    },
                  )
                }
                onDelete={() =>
                  mutate(() => deleteProjectFn({ data: { id: p.id } }), {
                    error: `Couldn't delete “${p.name}”.`,
                    optimistic: () => addOptimistic({ type: 'remove', id: p.id }),
                    // Leave before the refetch, or the queue still on screen is
                    // the one just deleted and its loader answers not found.
                    // Only the open project moves the user — deleting some other
                    // row from the sidebar should leave them where they are.
                    onSuccess: () => {
                      if (
                        matchRoute({
                          to: '/p/$projectId',
                          params: { projectId: p.id },
                        })
                      )
                        navigate({ to: '/' })
                    },
                  })
                }
              />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  /**
   * Collapsed rail: a group is one icon, and its rows live in the menu hung off
   * it. Switching queues is all the rail owes you — pinning and deleting wait
   * for the sidebar to come back, where the rows are readable.
   */
  function railGroup(
    label: string,
    icon: React.ComponentProps<typeof HugeiconsIcon>['icon'],
    rows: Array<ProjectSummary>,
  ) {
    if (rows.length === 0) return null
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={label}
            render={
              <SidebarMenuButton className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground" />
            }
          >
            <HugeiconsIcon icon={icon} />
            <span>{label}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start">
            {rows.map((p) => (
              <DropdownMenuItem
                key={p.id}
                render={
                  <Link to="/p/$projectId" params={{ projectId: p.id }} />
                }
              >
                <span className="truncate">{p.name}</span>
                {p.open > 0 && (
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {p.open}
                  </span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {group('Pinned', pinned)}
      {group('Projects', rest)}
    </div>
  )
}

// Shared by both row actions. showOnHover also reveals on focus-within, which
// left an action stuck on after a click — the row it navigated to keeps the
// focus. Swapped for focus-visible so only keyboard focus reveals it; both
// rules are md-only because below the breakpoint there is no hover to reveal
// anything and the actions stay visible. The hover rule is repeated here with !
// because that focus-within rule would otherwise outrank it — the md variant
// sorts later — and the row holding the focus is exactly the one you just
// navigated to, so its actions stayed hidden while the pointer was on it. No
// hover chip — the row already lights up underneath, so the icon going
// full-strength is affordance enough.
const rowActionClass =
  'top-1/2! -translate-y-1/2 text-sidebar-foreground/60 hover:bg-transparent hover:text-sidebar-accent-foreground md:group-focus-within/menu-item:opacity-0 md:group-hover/menu-item:opacity-100! md:group-has-[:focus-visible]/menu-item:opacity-100'

function ProjectRow({
  project,
  onDelete,
  onTogglePin,
  flat,
}: {
  project: ProjectSummary
  onDelete: () => void
  onTogglePin: () => void
  flat?: boolean
}) {
  // The menu can't own the dialog: Base UI unmounts the menu popup on close,
  // which would take a dialog rendered inside it down with it.
  const [confirming, setConfirming] = useState(false)
  const done = project.total - project.open
  const summary =
    project.total === 0
      ? 'No prompts yet'
      : project.open === 0
        ? `All ${project.total} done`
        : `${project.open} waiting${done ? ` · ${done} done` : ''}`

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        size={flat ? 'default' : 'lg'}
        variant={flat ? 'default' : 'outline'}
        // pr-18! is both actions' lane plus a gap. Below md the actions are
        // always on, so it is always reserved; from md they only appear on
        // hover/keyboard-focus/open-menu, so the name gets the full width until
        // then and the lane opens with them (the variant's
        // transition-[width,height,padding] eases it). That lane is the tighter
        // pr-15 — the actions end 3.25rem in, so 3.75rem is them plus a 0.5rem
        // gap, and the name keeps 12px more than the always-on lane. All ! because the base
        // variant's `group-has-data-[sidebar=menu-action]:pr-8` outranks a plain
        // pr-*; the conditional ones then outrank md:pr-3! on their extra
        // group selector. An action is a sibling sitting on top of this button,
        // so its own hover never reaches here — group-hover on the row is what
        // keeps the whole row lit while the pointer is on an action, and
        // has-[[data-popup-open]] holds that once the menu takes the pointer
        // away.
        className="pr-18! group-hover/menu-item:bg-sidebar-accent group-hover/menu-item:text-sidebar-accent-foreground group-has-[[data-popup-open]]/menu-item:bg-sidebar-accent data-[status=active]:bg-sidebar-accent data-[status=active]:font-medium data-[status=active]:text-sidebar-accent-foreground md:pr-3! md:group-hover/menu-item:pr-15! md:group-has-[:focus-visible]/menu-item:pr-15! md:group-has-[[data-popup-open]]/menu-item:pr-15!"
        render={<Link to="/p/$projectId" params={{ projectId: project.id }} />}
      >
        {flat ? (
          <>
            <span className="truncate">{project.name}</span>
            {/* Trails the name rather than sitting at the row's edge, where it
                collided with the hover action. shrink-0 so a long name
                ellipsises into the count instead of pushing it out of view;
                -ml-1 pulls it in from the row's gap-2. */}
            {project.open > 0 && (
              <span className="-ml-1 shrink-0 text-xs tabular-nums text-sidebar-foreground/50">
                · {project.open}
              </span>
            )}
          </>
        ) : (
          <span className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate font-medium">{project.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {summary}
            </span>
          </span>
        )}
      </SidebarMenuButton>

      {/* showOnHover is the built-in version of "hover on a pointer window,
          always on a phone" — a touch device has no hover to reveal it.
          Which group the row is in already says whether it is pinned, so this
          stays a plain hover action rather than a permanent badge. */}
      <SidebarMenuAction
        showOnHover
        onClick={onTogglePin}
        aria-label={`${project.pinned ? 'Unpin' : 'Pin'} ${project.name}`}
        className={cn(rowActionClass, 'right-8')}
      >
        <HugeiconsIcon icon={project.pinned ? PinOffIcon : PinIcon} />
      </SidebarMenuAction>

      <DropdownMenu>
        <SidebarMenuAction
          showOnHover
          render={<DropdownMenuTrigger />}
          aria-label={`Actions for ${project.name}`}
          // data-popup-open (alongside the built-in aria-expanded rule) keeps
          // the action up while its own menu is open.
          className={cn(
            rowActionClass,
            'right-1 data-popup-open:opacity-100',
          )}
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} />
        </SidebarMenuAction>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirming(true)}
          >
            <HugeiconsIcon icon={Delete02Icon} />
            Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete “${project.name}”?`}
        description={
          project.total === 0
            ? 'This project is empty. Deleting it cannot be undone.'
            : `Its ${project.total} ${project.total === 1 ? 'prompt is' : 'prompts are'} deleted with it. This cannot be undone.`
        }
        confirmLabel="Delete project"
        onConfirm={onDelete}
      />
    </SidebarMenuItem>
  )
}
