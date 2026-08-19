import { useRef, useState } from 'react'
import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  ArrowDown01Icon,
  Cancel01Icon,
  Delete02Icon,
  Folder01Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  PinIcon,
  PinOffIcon,
  SentIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { RenameField } from '@/components/rename-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Separator } from '@/components/ui/separator'
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
  autoFocus,
  className,
  placeholder = 'New project',
  onCreated,
}: {
  autoFocus?: boolean
  className?: string
  /** Overridden where the surface around the field already says "new project"
   *  and the placeholder would only repeat it. */
  placeholder?: string
  /** Fires before the navigation, so a surface holding this form can close
   *  itself rather than hanging over the queue it just opened. */
  onCreated?: () => void
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
      onSuccess: ({ id }) => {
        onCreated?.()
        navigate({ to: '/p/$projectId', params: { projectId: id } })
      },
    })
  }

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault()
        create()
      }}
    >
      <InputGroup>
        <InputGroupInput
          ref={inputRef}
          size="lg"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          aria-label="New project name"
          maxLength={200}
          autoComplete="off"
          enterKeyHint="done"
          autoFocus={autoFocus}
        />
        <InputGroupAddon align="inline-end">
          <Button
            type="submit"
            size="icon-xs"
            variant="ghost"
            disabled={!trimmed || saving}
            aria-label="Create project"
          >
            {saving ? <Spinner /> : <HugeiconsIcon icon={SentIcon} />}
          </Button>
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}

/**
 * The phone home screen's create action. The list is the page at that width, so
 * naming a project happens in a sheet this raises rather than in a field parked
 * above the list, spending a row of a small screen on a form that is wanted
 * once a week. The button sits under the thumb; the field it opens sits above
 * the keyboard that opens with it.
 */
export function NewProjectFab() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="New project"
        render={
          // Anchored to the pane rather than the viewport: `fixed` would leave
          // it hanging over the desktop pane's own create form as well.
          //
          // Half the bottom inset, not all of it. The full one is the whole
          // home-indicator zone — twice the 16px this sits off the right edge,
          // which reads as the button having drifted up the screen rather than
          // as it sitting in the corner. Half clears the indicator bar itself,
          // which is all there is down there to clear.
          <Button className="absolute right-4 bottom-[max(1rem,calc(env(safe-area-inset-bottom)/2))] z-30 size-14 rounded-full shadow-lg" />
        }
      >
        <HugeiconsIcon icon={Add01Icon} className="size-6" />
      </SheetTrigger>

      <SheetContent
        side="bottom"
        // The sheet's own close, at 44px rather than the built-in 32px one: the
        // keyboard opens with this sheet and covers the backdrop, so the X is
        // often the only dismissal left on screen.
        showCloseButton={false}
        className="rounded-t-4xl pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="flex-row items-center justify-between pb-4">
          <SheetTitle className="text-lg">New project</SheetTitle>
          <SheetClose
            aria-label="Cancel"
            render={<Button variant="ghost" size="icon" className="-mr-2 size-11" />}
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-5" />
          </SheetClose>
        </SheetHeader>
        <div className="px-6">
          {/* Closes on the way out rather than on unmount, so the sheet is gone
              before the queue it just created paints under it. */}
          <NewProjectForm
            autoFocus
            placeholder="Project name"
            onCreated={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
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
  sidebar,
}: {
  projects: Array<ProjectSummary>
  /** The desktop switcher's copy: label-sized rows beside the page you are
   *  working in, foldable groups, and a collapsed rail shape. Without it this
   *  is the phone home screen, where the list *is* the page — and since that
   *  pane is `md:hidden`, the two never render at the same width. */
  sidebar?: boolean
}) {
  const [, mutate] = useMutate()
  const navigate = useNavigate()
  const matchRoute = useMatchRoute()
  const [projects, addOptimistic] = useOptimisticList(loaded, applyProjectAction)
  const [confirming, setConfirming] = useState<ProjectSummary | null>(null)
  const { state, isMobile } = useSidebar()
  // Only the sidebar copy can be collapsed — the home pane renders below the
  // breakpoint, where the sidebar is a full-width sheet.
  const collapsed = !!sidebar && state === 'collapsed' && !isMobile

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

  if (projects.length === 0) {
    const empty = (
      // The rail draws its own hairline box; on the home pane the Card around
      // this one supplies it, along with the rest of the kit's surface.
      <Empty className={cn(sidebar && 'border')}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={Folder01Icon} />
          </EmptyMedia>
          <EmptyTitle>No projects yet</EmptyTitle>
          {/* The sidebar copy cannot say where to start, because the control
              that starts one is on the home pane, not in the rail. The home
              pane can, and now has to: its create action is a button in the
              corner rather than a field sitting above this message. */}
          <EmptyDescription>
            A project is one queue of prompts — usually one per codebase.
            {!sidebar && ' Tap + to start your first.'}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
    // The home pane's projects live in a card; so does the message standing in
    // for them, or the screen loses its one surface the moment it is empty.
    return sidebar ? empty : <Card>{empty}</Card>
  }

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
            <SidebarMenu>
              {rows.map((p) => (
                <ProjectRow key={p.id} project={p} {...handlers(p)} />
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

  /**
   * The phone home screen's section. No fold here: in the sidebar a group
   * competes with the page beside it for height, but on the home screen the
   * list is the only thing there — and the heading's chevron is revealed on
   * hover, so on a touch screen folding the whole page away is a control you
   * cannot see until after you have hit it.
   *
   * The heading itself only appears once there is a second section to tell it
   * apart from. One list under a bar reading "Projects", under a bar reading
   * "toprompt", is a label for something nothing else could be.
   */
  function homeGroup(label: string, rows: Array<ProjectSummary>) {
    if (rows.length === 0) return null
    return (
      <section>
        {/* Outside the frame, not in its CardFrameHeader: the frame is the
            <ul>, and a heading inside it would be a non-<li> child of a list.
            px-1 sets it just inside the card's edge, the way a grouped list
            titles the block under it. */}
        {pinned.length > 0 && (
          <h2 className="px-1 pb-2 text-sm font-medium text-muted-foreground">
            {label}
          </h2>
        )}
        {/* One Card holding the whole run, rather than CardFrame holding one
            Card each: the frame keeps every panel's own 14px corners, so four
            projects come out as four rounded objects to consider instead of one
            list to pick from. A single card with Separator seams is the same
            kit parts saying the thing this screen means.

            overflow-hidden so the first and last rows' press tint stops at the
            card's radius instead of squaring off its corners. */}
        <Card className="overflow-hidden" render={<ul />}>
          {rows.map((p, i) => (
            <HomeRow
              key={p.id}
              project={p}
              seam={i > 0}
              {...handlers(p)}
            />
          ))}
        </Card>
      </section>
    )
  }

  if (!sidebar)
    return (
      <div className="flex flex-col gap-6">
        {homeGroup('Pinned', pinned)}
        {homeGroup('Projects', rest)}
      </div>
    )

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

// Below `md` these are always-on controls on a touch screen, so they are sized
// as ones: a 36px square with a 20px glyph, laid out edge to edge with a real
// gap between them. The built-in `after:-inset-2` that stretched a 20px icon to
// a 36px hit area comes off with them — at 36px the button *is* the target, and
// the two expanded hit boxes used to overlap. From `md` up the pair is back to
// the 20px hover affordance the sidebar is drawn around.
//
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
  'top-1/2! size-9 -translate-y-1/2 text-sidebar-foreground/60 after:hidden hover:bg-transparent hover:text-sidebar-accent-foreground md:size-5 [&>svg]:size-5 md:[&>svg]:size-4 md:group-focus-within/menu-item:opacity-0 md:group-hover/menu-item:opacity-100! md:group-has-[:focus-visible]/menu-item:opacity-100'

/**
 * One project on the phone home screen — a row inside the section's Card, not a
 * card of its own.
 *
 * The row carries exactly what the screen is for — which queue, and how much is
 * still waiting in it. The count is a trailing badge rather than a second line
 * of prose, because the question here is "which of these has work in it", and
 * that is a column you compare down, not four sentences you read one at a time.
 * Everything the sidebar row also carries — a leading folder, a pin button of
 * its own — is chrome that only competes with it.
 *
 * The three writes live behind one ⋯, the same control the queue's own topbar
 * uses for the same three things. A permanently visible pin *and* ⋯ on every
 * row spent a quarter of a phone's width on actions wanted about once a week,
 * and put a 36px destructive-menu trigger under the thumb that was reaching to
 * open the project.
 */
function HomeRow({
  project,
  onDelete,
  onRename,
  onTogglePin,
  seam,
}: {
  project: ProjectSummary
  onDelete: () => void
  onRename: (name: string) => void
  onTogglePin: () => void
  /** Every row but the first draws the hairline above it. Carried by the row
   *  rather than sat between rows, because the card renders a <ul> and a
   *  separator is not an <li>. */
  seam?: boolean
}) {
  // The menu can't own the dialog: Base UI unmounts the menu popup on close,
  // which would take a dialog rendered inside it down with it.
  const [confirming, setConfirming] = useState(false)
  const [renaming, setRenaming] = useState(false)
  // Held here rather than inside the field: the ⋯ menu hands focus to it on
  // close, and by then the field it opened is already mounted.
  const renameRef = useRef<HTMLInputElement>(null)

  // Inset to where the names start, so the seams read as breaks in one column
  // of text rather than as bands stacked on each other.
  const separator = seam ? <Separator className="ml-4 w-auto" /> : null

  if (renaming)
    return (
      // p-1.5 around a 44px field is the 56px the row it replaces was, so the
      // rows under it do not shift while one is being edited.
      <li>
        {separator}
        <div className="p-1.5">
          <RenameField
            ref={renameRef}
            name={project.name}
            onRename={onRename}
            onClose={() => setRenaming(false)}
            className="h-11 text-base"
          />
        </div>
      </li>
    )

  return (
    <li className="relative">
      {separator}
      <Link
        to="/p/$projectId"
        params={{ projectId: project.id }}
        // pr-16 is the ⋯'s lane plus enough air that the count reads as the
        // row's own rather than as a label on the button. active:, not hover: —
        // this row only ever renders on a touch screen, and the page suppresses
        // the browser's own tap highlight, so without this a tap gives no
        // feedback at all while the queue loads.
        className="flex min-h-14 items-center gap-3 px-4 py-2 pr-16 transition-colors active:bg-accent"
      >
        <span className="min-w-0 flex-1 truncate text-base font-medium">
          {project.name}
        </span>
        {/* A badge, not a bare numeral: the count is the one thing on this
            screen that is a value rather than a label, and the kit's chip is
            what says so. Secondary rather than the default fill — every row
            carries one, and a column of primary-coloured pills would out-shout
            the names they belong to. */}
        {project.open > 0 ? (
          <Badge variant="secondary" className="tabular-nums">
            {project.open}
            <span className="sr-only">
              {project.open === 1 ? ' prompt waiting' : ' prompts waiting'}
            </span>
          </Badge>
        ) : project.total > 0 ? (
          <>
            {/* No badge for a finished queue: a chip is for a quantity, and
                this is the absence of one. */}
            <HugeiconsIcon
              icon={Tick02Icon}
              className="size-4 shrink-0 text-muted-foreground/70"
              aria-hidden
            />
            <span className="sr-only">All done</span>
          </>
        ) : null}
      </Link>

      {/* A sibling of the link, not a child: a child would make every press on
          it navigate. size-11 is the queue topbar's ⋯ — the same control for
          the same three actions, at the same size, on both screens. */}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${project.name}`}
          render={
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-1 size-11 -translate-y-1/2 text-muted-foreground"
            />
          }
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} className="size-5" />
        </DropdownMenuTrigger>
        {/* Hangs off the right edge it sits on, rather than off the screen. */}
        <DropdownMenuContent align="end" finalFocus={renameRef}>
          <DropdownMenuItem onClick={onTogglePin}>
            <HugeiconsIcon icon={project.pinned ? PinOffIcon : PinIcon} />
            {project.pinned ? 'Unpin' : 'Pin to top'}
          </DropdownMenuItem>
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
    </li>
  )
}

function ProjectRow({
  project,
  onDelete,
  onRename,
  onTogglePin,
}: {
  project: ProjectSummary
  onDelete: () => void
  onRename: (name: string) => void
  onTogglePin: () => void
}) {
  // The menu can't own the dialog: Base UI unmounts the menu popup on close,
  // which would take a dialog rendered inside it down with it.
  const [confirming, setConfirming] = useState(false)
  const [renaming, setRenaming] = useState(false)
  // Held here rather than inside the field: the ⋯ menu hands focus to it on
  // close, and by then the field it opened is already mounted.
  const renameRef = useRef<HTMLInputElement>(null)

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
          className="h-9 rounded-lg px-3 text-sm"
        />
      </SidebarMenuItem>
    )

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        // pr-22! is both actions' lane plus a gap. Below md the actions are
        // always on and 36px wide, so 5.5rem is always reserved; from md they
        // shrink to 20px and only appear on hover/keyboard-focus/open-menu, so
        // the name gets the full width until then and the lane opens with them
        // (the variant's transition-[width,height,padding] eases it). That lane
        // is the tighter pr-15 — the actions end 3.25rem in, so 3.75rem is them
        // plus a 0.5rem gap. All ! because the base
        // variant's `group-has-data-[sidebar=menu-action]:pr-8` outranks a plain
        // pr-*; the conditional ones then outrank md:pr-3! on their extra
        // group selector. An action is a sibling sitting on top of this button,
        // so its own hover never reaches here — group-hover on the row is what
        // keeps the whole row lit while the pointer is on an action, and
        // has-[[data-popup-open]] holds that once the menu takes the pointer
        // away.
        className="pr-22! group-hover/menu-item:bg-sidebar-accent group-hover/menu-item:text-sidebar-accent-foreground group-has-[[data-popup-open]]/menu-item:bg-sidebar-accent data-[status=active]:bg-sidebar-accent data-[status=active]:font-medium data-[status=active]:text-sidebar-accent-foreground md:pr-3! md:group-hover/menu-item:pr-15! md:group-has-[:focus-visible]/menu-item:pr-15! md:group-has-[[data-popup-open]]/menu-item:pr-15!"
        render={<Link to="/p/$projectId" params={{ projectId: project.id }} />}
      >
        {/* Every row leads with a glyph — the sidebar is a list of one kind of
            thing, and a leading icon gives the names a common left edge to hang
            off. Pinned rows swap the folder for the pin, so they still read as
            pinned once the group heading has scrolled off. The menu button
            already sizes and spaces any svg it holds. */}
        <HugeiconsIcon
          icon={project.pinned ? PinIcon : Folder01Icon}
          className="text-sidebar-foreground/60"
        />
        <span className="truncate">{project.name}</span>
        {/* Trails the name rather than sitting at the row's edge, where it
            collided with the hover action. shrink-0 so a long name ellipsises
            into the count instead of pushing it out of view; -ml-1 pulls it in
            from the row's gap-2. */}
        {project.open > 0 && (
          <span className="-ml-1 shrink-0 text-xs tabular-nums text-sidebar-foreground/50">
            · {project.open}
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
        // Clears the ⋯ at either size: 36px buttons need 44px of offset, 20px
        // ones need 32.
        className={cn(rowActionClass, 'right-11 md:right-8')}
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
