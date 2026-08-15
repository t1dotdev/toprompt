import { useOptimistic, useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Alert02Icon,
  ArrowRight01Icon,
  Delete02Icon,
  DragDropVerticalIcon,
  Folder01Icon,
  RefreshIcon,
} from '@hugeicons/core-free-icons'
import { AppHeader } from '@/components/app-header'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/user-menu'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { useMutate } from '@/lib/use-mutate'
import {
  type ProjectSummary,
  createProjectFn,
  deleteProjectFn,
  listProjectsFn,
  reorderProjectsFn,
} from '@/lib/fns'

export const Route = createFileRoute('/_authed/')({
  head: () => ({ meta: [{ title: 'Projects · toprompt' }] }),
  loader: () => listProjectsFn(),
  pendingComponent: ProjectsPending,
  errorComponent: ProjectsError,
  component: Projects,
})

// Only one create can be in flight (the form disables while pending), so a
// fixed id is enough to key the placeholder row and keeps the reducer pure.
const PENDING_ID = '__pending__'

type ProjectAction =
  | { type: 'add'; name: string }
  | { type: 'remove'; id: string }
  | { type: 'reorder'; ids: Array<string> }

function applyProjectAction(
  projects: Array<ProjectSummary>,
  action: ProjectAction,
): Array<ProjectSummary> {
  switch (action.type) {
    case 'remove':
      return projects.filter((p) => p.id !== action.id)
    case 'reorder': {
      const rank = new Map(action.ids.map((id, i) => [id, i]))
      // -1 for anything the drag didn't know about (a create that landed
      // mid-drag), which keeps new projects at the top where they belong.
      return [...projects].sort(
        (a, b) => (rank.get(a.id) ?? -1) - (rank.get(b.id) ?? -1),
      )
    }
    case 'add':
      return [
        {
          id: PENDING_ID,
          name: action.name,
          createdAt: new Date(0),
          total: 0,
          open: 0,
        },
        ...projects,
      ]
  }
}

function Projects() {
  const { user } = Route.useRouteContext()
  // Two transitions, not one: deleting a project must not make the new-project
  // form look like it is submitting the name still sitting in the input.
  const [saving, save] = useMutate()
  const [, mutate] = useMutate()
  const [projects, addOptimistic] = useOptimistic(
    Route.useLoaderData(),
    applyProjectAction,
  )
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Touch is the primary input here, so the pointer sensor needs a small
  // movement threshold — without it a tap that drifts a pixel starts a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = projects.findIndex((p) => p.id === active.id)
    const to = projects.findIndex((p) => p.id === over.id)
    if (from < 0 || to < 0) return
    // A placeholder row has no server id yet; it takes its position from the
    // insert instead.
    const ids = arrayMove(projects, from, to)
      .map((p) => p.id)
      .filter((id) => id !== PENDING_ID)
    mutate(() => reorderProjectsFn({ data: { ids } }), {
      error: "Couldn't save the new order.",
      optimistic: () => addOptimistic({ type: 'reorder', ids }),
    })
  }

  const trimmed = name.trim()

  function create() {
    if (!trimmed || saving) return
    setName('')
    // Keeps focus in the field so several projects can be added in a row.
    inputRef.current?.focus()
    save(() => createProjectFn({ data: { name: trimmed } }), {
      error: `Couldn't create “${trimmed}”.`,
      optimistic: () => addOptimistic({ type: 'add', name: trimmed }),
      onError: () => setName(trimmed),
    })
  }

  return (
    <ProjectsShell
      action={<UserMenu user={user} />}
    >
      <form
        className="mb-6 flex gap-2"
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
          className="h-11"
        />
        <Button
          type="submit"
          size="icon"
          className="size-11"
          disabled={!trimmed || saving}
          aria-label="Add project"
        >
          {saving ? <Spinner /> : <HugeiconsIcon icon={Add01Icon} />}
        </Button>
      </form>

      {projects.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Folder01Icon} />
            </EmptyMedia>
            <EmptyTitle>No projects yet</EmptyTitle>
            <EmptyDescription>
              A project is one queue of prompts — usually one per codebase. Name
              it above and it appears here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          // The list only moves on one axis, and a row dragged outside it has
          // nowhere to land.
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={projects.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-2">
              {projects.map((p) => (
                <ProjectRow
                  key={p.id}
                  project={p}
                  onDelete={() =>
                    mutate(() => deleteProjectFn({ data: { id: p.id } }), {
                      error: `Couldn't delete “${p.name}”.`,
                      optimistic: () =>
                        addOptimistic({ type: 'remove', id: p.id }),
                    })
                  }
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </ProjectsShell>
  )
}

/** Chrome shared by the project list and by its pending / error states. */
function ProjectsShell({
  action,
  children,
}: {
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh">
      <AppHeader>
        <h1 className="flex flex-1 items-center gap-2 text-xl font-bold tracking-tight">
          <Logo size={20} />
          toprompt
        </h1>
        {/* In the shell rather than the action prop so the toggle is still
            there on the pending and error screens, which pass no action. */}
        <ThemeToggle />
        {action}
      </AppHeader>
      <main className="mx-auto max-w-md px-4 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  )
}

function ProjectRow({
  project,
  onDelete,
}: {
  project: ProjectSummary
  onDelete: () => void
}) {
  const isPending = project.id === PENDING_ID
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id, disabled: isPending })
  const done = project.total - project.open
  const summary =
    project.total === 0
      ? 'No prompts yet'
      : project.open === 0
        ? `All ${project.total} done`
        : `${project.open} waiting${done ? ` · ${done} done` : ''}`

  if (isPending) {
    return (
      <li className="flex min-h-14 items-center gap-3 rounded-xl border px-4 opacity-60">
        <span className="min-w-0 flex-1 truncate font-medium">
          {project.name}
        </span>
        <Spinner className="text-muted-foreground" />
      </li>
    )
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'flex items-center rounded-xl border bg-background transition-colors hover:bg-muted/40 has-[a:active]:bg-muted/60 has-[a:focus-visible]:bg-muted/40',
        // Lifted off the list so it is obvious which row is being carried.
        isDragging && 'relative z-10 shadow-lg',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${project.name}`}
        // touch-none stops the browser claiming the gesture as a page scroll.
        className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground outline-none transition-colors select-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing"
      >
        <HugeiconsIcon icon={DragDropVerticalIcon} className="size-4" />
      </button>
      <Link
        to="/p/$projectId"
        params={{ projectId: project.id }}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pr-1 outline-none"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{project.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {summary}
          </span>
        </span>
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          className="size-4 shrink-0 text-muted-foreground"
        />
      </Link>
      <ConfirmDialog
        title={`Delete “${project.name}”?`}
        description={
          project.total === 0
            ? 'This project is empty. Deleting it cannot be undone.'
            : `Its ${project.total} ${project.total === 1 ? 'prompt is' : 'prompts are'} deleted with it. This cannot be undone.`
        }
        confirmLabel="Delete project"
        onConfirm={onDelete}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            className="mr-1 size-11 text-muted-foreground hover:text-destructive"
            aria-label={`Delete ${project.name}`}
          >
            <HugeiconsIcon icon={Delete02Icon} />
          </Button>
        }
      />
    </li>
  )
}

function ProjectsPending() {
  return (
    <ProjectsShell>
      <div className="mb-6 flex gap-2">
        <Skeleton className="h-11 flex-1 rounded-4xl" />
        <Skeleton className="size-11 rounded-4xl" />
      </div>
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    </ProjectsShell>
  )
}

function ProjectsError({ reset }: { reset: () => void }) {
  return (
    <ProjectsShell>
      <Empty className="border">
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
    </ProjectsShell>
  )
}
