import { useRef, useState } from 'react'
import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  ArrowDown01Icon,
  Delete02Icon,
  Folder01Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  PinIcon,
  PinOffIcon,
} from '@hugeicons/core-free-icons'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { RenameField } from '@/components/rename-field'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
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
  renameProjectFn,
  setProjectPinnedFn,
} from '@/lib/fns'

type ProjectAction =
  | { type: 'remove'; id: string }
  | { type: 'pin'; id: string; pinned: boolean }
  | { type: 'rename'; id: string; name: string }

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
    case 'rename':
      return projects.map((p) =>
        p.id === action.id ? { ...p, name: action.name } : p,
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
  const [confirming, setConfirming] = useState<ProjectSummary | null>(null)
  const { state, isMobile } = useSidebar()
  // Only the sidebar copy can be collapsed — the home pane renders below the
  // breakpoint, where the sidebar is a full-width sheet.
  const collapsed = !!flat && state === 'collapsed' && !isMobile

  const pinned = projects.filter((p) => p.pinned)
  const rest = projects.filter((p) => !p.pinned)

  /**
   * The same three writes behind a row wherever it is drawn — the expanded
   * list and the rail's menu each hand them to their own row.
   */
  function handlers(p: ProjectSummary) {
    return {
      onTogglePin: () =>
        mutate(
          () => setProjectPinnedFn({ data: { id: p.id, pinned: !p.pinned } }),
          {
            error: `Couldn't ${p.pinned ? 'unpin' : 'pin'} “${p.name}”.`,
            optimistic: () =>
              addOptimistic({ type: 'pin', id: p.id, pinned: !p.pinned }),
          },
        ),
      onRename: (name: string) =>
        mutate(() => renameProjectFn({ data: { id: p.id, name } }), {
          error: `Couldn't rename “${p.name}”.`,
          optimistic: () => addOptimistic({ type: 'rename', id: p.id, name }),
        }),
      onDelete: () =>
        mutate(() => deleteProjectFn({ data: { id: p.id } }), {
          error: `Couldn't delete “${p.name}”.`,
          optimistic: () => addOptimistic({ type: 'remove', id: p.id }),
          // Leave before the refetch, or the queue still on screen is the one
          // just deleted and its loader answers not found. Only the open
          // project moves the user — deleting some other row from the sidebar
          // should leave them where they are.
          onSuccess: () => {
            if (matchRoute({ to: '/p/$projectId', params: { projectId: p.id } }))
              navigate({ to: '/' })
          },
        }),
    }
  }

  if (collapsed)
    return (
      <>
        {/* gap-2, not the menu default gap-1: the rail keeps one 8px step
            between every icon, including across the header seam above it. */}
        <SidebarMenu className="gap-2">
          {railGroup('Pinned', PinIcon, pinned)}
          {railGroup('Projects', Folder01Icon, rest)}
        </SidebarMenu>
        {/* Outside both menus on purpose. Picking Delete closes the popup the
            row was drawn in, and a dialog mounted in there would go down with
            it — so the rail's confirm lives out here and only remembers which
            project it is for. */}
        <ConfirmDialog
          open={!!confirming}
          onOpenChange={(open) => !open && setConfirming(null)}
          title={`Delete “${confirming?.name}”?`}
          description={
            confirming?.total === 0
              ? 'This project is empty. Deleting it cannot be undone.'
              : `Its ${confirming?.total} ${confirming?.total === 1 ? 'prompt is' : 'prompts are'} deleted with it. This cannot be undone.`
          }
          confirmLabel="Delete project"
          onConfirm={() => confirming && handlers(confirming).onDelete()}
        />
      </>
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
        {/* <details>, not state: the browser already owns "click the heading to
            fold the section", including the keyboard and the aria-expanded that
            comes with it, and an uncontrolled `open` survives re-renders. */}
        <details open className="group/collapsible">
          <SidebarGroupLabel
            render={<summary />}
            // list-none plus the webkit rule drop the native triangle — the
            // chevron below is the marker. `flex` on the label already fights
            // summary's display, so the marker has to go explicitly.
            className="group/label cursor-pointer list-none gap-1 select-none hover:text-sidebar-foreground [&::-webkit-details-marker]:hidden"
          >
            {label}
            {/* Points right while folded, down while open. Folded it stays on
                screen — with the rows gone it is the only thing left saying the
                section is still there; open, the rows say that themselves, so
                it waits to be pointed at. Both reveal rules stack the open
                variant so they outrank the hide on specificity rather than on
                wherever Tailwind happens to sort hover against open. */}
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className="-rotate-90 transition-[opacity,rotate] group-open/collapsible:rotate-0 group-open/collapsible:opacity-0 group-open/collapsible:group-hover/label:opacity-100 group-open/collapsible:group-focus-visible/label:opacity-100"
            />
          </SidebarGroupLabel>
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
                  {...handlers(p)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </details>
      </SidebarGroup>
    )
  }

  /**
   * Collapsed rail: a group is one icon, and its rows live in the menu hung off
   * it. The rows carry the same actions the expanded list gives them — the rail
   * is the sidebar at this width, not a reduced copy of it.
   */
  function railGroup(
    label: string,
    icon: React.ComponentProps<typeof HugeiconsIcon>['icon'],
    rows: Array<ProjectSummary>,
  ) {
    if (rows.length === 0) return null
    return (
      <SidebarMenuItem>
        {/* A popover, not a menu. A menu activates and closes on the first
            thing you touch and runs typeahead over every keystroke — these rows
            have to survive a nested action menu opening over them and a rename
            field being typed into. */}
        <Popover>
          <PopoverTrigger
            aria-label={label}
            render={
              <SidebarMenuButton className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground" />
            }
          >
            <HugeiconsIcon icon={icon} />
            <span>{label}</span>
          </PopoverTrigger>
          {/* w-64 because the anchor is a 32px rail icon, and the rows have two
              actions to house. */}
          <PopoverContent side="right" align="start" className="w-64">
            {rows.map((p) => (
              <RailRow
                key={p.id}
                project={p}
                onConfirmDelete={() => setConfirming(p)}
                {...handlers(p)}
              />
            ))}
          </PopoverContent>
        </Popover>
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

/**
 * One project inside the rail's popover. The same three actions the expanded
 * row has, in a list that has to stay open while they are used.
 */
function RailRow({
  project,
  onTogglePin,
  onRename,
  onConfirmDelete,
}: {
  project: ProjectSummary
  onTogglePin: () => void
  onRename: (name: string) => void
  /** Delete is confirmed outside this popover — see the dialog in ProjectList. */
  onConfirmDelete: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  const renameRef = useRef<HTMLInputElement>(null)

  if (renaming)
    return (
      <RenameField
        ref={renameRef}
        name={project.name}
        onRename={onRename}
        onClose={() => setRenaming(false)}
        // The row's own footprint, so the list doesn't shift as the field takes
        // over: same height, radius and text inset as the link it replaces.
        className="h-9 rounded-xl px-3 text-sm"
      />
    )

  return (
    <div className="group/rail relative flex items-center rounded-xl transition-colors hover:bg-accent has-[[data-popup-open]]:bg-accent">
      {/* The name yields the lane rather than the actions overlapping it: 4rem
          of padding appears under the pointer and the name re-ellipsises into
          what is left. Nothing is reserved at rest, so a short list of short
          names reads as plain text. */}
      <Link
        to="/p/$projectId"
        params={{ projectId: project.id }}
        className="flex min-w-0 flex-1 items-center gap-1 rounded-xl px-3 py-2 text-sm outline-none transition-[padding] group-hover/rail:pr-16 group-focus-within/rail:pr-16 group-has-[[data-popup-open]]/rail:pr-16"
      >
        <span className="truncate">{project.name}</span>
        {/* Trails the name, so a long name ellipsises into the count instead of
            pushing it under the actions. */}
        {project.open > 0 && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            · {project.open}
          </span>
        )}
      </Link>

      {/* Siblings of the link, laid over the lane it just gave up — children
          would make every click on them navigate. */}
      <div className="absolute inset-y-0 right-1 flex items-center opacity-0 transition-opacity group-hover/rail:opacity-100 group-focus-within/rail:opacity-100 group-has-[[data-popup-open]]/rail:opacity-100">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:bg-transparent hover:text-foreground"
          aria-label={`${project.pinned ? 'Unpin' : 'Pin'} ${project.name}`}
          onClick={onTogglePin}
        >
          <HugeiconsIcon icon={project.pinned ? PinOffIcon : PinIcon} />
        </Button>

        {/* Its own menu, portalled out of the popover. Base UI keeps the two in
            one floating tree, so opening this one does not read as a press
            outside the list underneath it. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for ${project.name}`}
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:bg-transparent hover:text-foreground"
              />
            }
          >
            <HugeiconsIcon icon={MoreHorizontalIcon} />
          </DropdownMenuTrigger>
          {/* finalFocus lands the caret in the field rather than back on the ⋯
              that opened it — by the time focus returns it is already mounted. */}
          <DropdownMenuContent align="end" finalFocus={renameRef}>
            <DropdownMenuItem onClick={() => setRenaming(true)}>
              <HugeiconsIcon icon={PencilEdit02Icon} />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onConfirmDelete}>
              <HugeiconsIcon icon={Delete02Icon} />
              Delete project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
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
  onRename,
  onTogglePin,
  flat,
}: {
  project: ProjectSummary
  onDelete: () => void
  onRename: (name: string) => void
  onTogglePin: () => void
  flat?: boolean
}) {
  // The menu can't own the dialog: Base UI unmounts the menu popup on close,
  // which would take a dialog rendered inside it down with it.
  const [confirming, setConfirming] = useState(false)
  const [renaming, setRenaming] = useState(false)
  // Held here rather than inside the field: the ⋯ menu hands focus to it on
  // close, and by then the field it opened is already mounted.
  const renameRef = useRef<HTMLInputElement>(null)
  const done = project.total - project.open
  const summary =
    project.total === 0
      ? 'No prompts yet'
      : project.open === 0
        ? `All ${project.total} done`
        : `${project.open} waiting${done ? ` · ${done} done` : ''}`

  if (renaming)
    return (
      <SidebarMenuItem>
        <RenameField
          ref={renameRef}
          name={project.name}
          onRename={onRename}
          onClose={() => setRenaming(false)}
          // Sits in the row's own footprint so the name does not jump when the
          // field takes over: same height, radius and text inset as the button
          // it replaces.
          className={cn('rounded-lg px-3 text-sm', flat ? 'h-9' : 'h-14')}
        />
      </SidebarMenuItem>
    )

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
            {/* Every row leads with a glyph — the sidebar is a list of one kind
                of thing, and a leading icon gives the names a common left edge
                to hang off. Pinned rows swap the folder for the pin, so they
                still read as pinned once the group heading has scrolled off.
                The menu button already sizes and spaces any svg it holds. */}
            <HugeiconsIcon
              icon={project.pinned ? PinIcon : Folder01Icon}
              className="text-sidebar-foreground/60"
            />
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
        {/* The menu returns focus on close, and by then the field it opened is
            already mounted — so the caret lands in the row itself instead of
            back on the ⋯ the user just left. A null ref (any other item, or
            Escape) falls back to the trigger, which is the default. */}
        <DropdownMenuContent align="start" finalFocus={renameRef}>
          <DropdownMenuItem onClick={() => setRenaming(true)}>
            <HugeiconsIcon icon={PencilEdit02Icon} />
            Rename
          </DropdownMenuItem>
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
