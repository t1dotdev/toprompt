import { useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert02Icon,
  ArrowLeft01Icon,
  Copy01Icon,
  Delete02Icon,
  Note01Icon,
  RefreshIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { AppHeader } from '@/components/app-header'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useMutate, useOptimisticList } from '@/lib/use-mutate'
import {
  createPromptFn,
  deletePromptFn,
  getProjectFn,
  restorePromptFn,
  togglePromptFn,
} from '@/lib/fns'

export const Route = createFileRoute('/_authed/p/$projectId')({
  loader: ({ params }) => getProjectFn({ data: { id: params.projectId } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.project.name} · toprompt` : 'toprompt' },
    ],
  }),
  pendingComponent: ProjectPending,
  errorComponent: ProjectError,
  notFoundComponent: ProjectNotFound,
  component: ProjectView,
})

type Prompt = Awaited<ReturnType<typeof getProjectFn>>['prompts'][number]

// Only one create can be in flight (the form disables while pending), so a fixed
// id is enough to key the placeholder row and keeps the reducer pure.
const PENDING_ID = '__pending__'

// Long prompts are the norm here — text runs to 10k characters. Clamping by
// length rather than measuring keeps the list scannable without a ResizeObserver
// on every row.
const CLAMP_OVER_CHARS = 260

type PromptAction =
  | { type: 'add'; text: string }
  | { type: 'toggle'; id: string; done: boolean }
  | { type: 'remove'; id: string }

function applyPromptAction(
  prompts: Array<Prompt>,
  action: PromptAction,
): Array<Prompt> {
  switch (action.type) {
    case 'add':
      return [
        {
          id: PENDING_ID,
          projectId: '',
          text: action.text,
          done: false,
          createdAt: new Date(0),
        },
        ...prompts,
      ]
    case 'toggle':
      return prompts.map((p) =>
        p.id === action.id ? { ...p, done: action.done } : p,
      )
    case 'remove':
      return prompts.filter((p) => p.id !== action.id)
  }
}

async function copyPrompt(text: string) {
  if (!navigator.clipboard) {
    toast.error('Copying needs a secure (https) connection.')
    return false
  }
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
    return true
  } catch {
    toast.error("Couldn't copy — select the text and copy it manually.")
    return false
  }
}

function ProjectView() {
  const { project, prompts: loaded } = Route.useLoaderData()
  // Two of them, not one: a row action must not make the compose form look
  // like it is submitting the draft still sitting in the textarea.
  const [saving, save] = useMutate()
  const [, mutate] = useMutate()
  const [prompts, addOptimistic] = useOptimisticList(loaded, applyPromptAction)
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const trimmed = text.trim()
  const open = prompts.filter((p) => !p.done)
  const done = prompts.filter((p) => p.done)

  function create() {
    if (!trimmed || saving) return
    setText('')
    // Keeps focus in the field so several prompts can be captured in a row.
    textareaRef.current?.focus()
    save(() => createPromptFn({ data: { projectId: project.id, text: trimmed } }), {
      error: "Couldn't save that prompt.",
      optimistic: () => addOptimistic({ type: 'add', text: trimmed }),
      onError: () => setText(trimmed),
    })
  }

  function toggle(p: Prompt, done: boolean) {
    mutate(() => togglePromptFn({ data: { id: p.id, done } }), {
      error: "Couldn't update that prompt.",
      optimistic: () => addOptimistic({ type: 'toggle', id: p.id, done }),
    })
  }

  function remove(p: Prompt) {
    mutate(() => deletePromptFn({ data: { id: p.id } }), {
      error: "Couldn't delete that prompt.",
      optimistic: () => addOptimistic({ type: 'remove', id: p.id }),
    })
    // Undo rather than a confirmation dialog: deleting is routine here, and a
    // prompt is long enough to be genuinely painful to retype.
    toast('Prompt deleted', {
      action: {
        label: 'Undo',
        onClick: () =>
          mutate(
            () =>
              restorePromptFn({
                data: {
                  id: p.id,
                  projectId: project.id,
                  text: p.text,
                  done: p.done,
                  createdAt: new Date(p.createdAt).toISOString(),
                },
              }),
            { error: "Couldn't restore that prompt." },
          ),
      },
    })
  }

  function rows(list: Array<Prompt>) {
    return list.map((p) => (
      <PromptRow
        key={p.id}
        prompt={p}
        onToggle={(checked) => toggle(p, checked)}
        onDelete={() => remove(p)}
      />
    ))
  }

  return (
    <ProjectShell
      title={project.name}
      composer={
        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault()
            create()
          }}
        >
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                create()
              }
            }}
            placeholder="Write a prompt…"
            aria-label="New prompt"
            maxLength={10000}
            // The project-name pill, still a textarea: prompts arrive multi-line
            // and run to 10k characters. field-sizing-content grows it, max-h-48
            // stops it swallowing the queue above. pr-* is the button's lane —
            // without it a long line types straight under the button.
            className="max-h-48 min-h-13 overflow-y-auto rounded-4xl py-3.5 pr-20 pl-5 sm:pr-28 md:text-base"
          />
          {/* Bottom-anchored, so it stays put as the field grows. */}
          <Button
            type="submit"
            className="absolute right-1.5 bottom-1.5 h-10 px-4"
            disabled={!trimmed || saving}
          >
            {saving && <Spinner />}
            Add
            <kbd
              aria-hidden
              className="ml-1 hidden font-sans text-xs opacity-60 sm:inline"
            >
              ⌘↵
            </kbd>
          </Button>
        </form>
      }
    >
      {prompts.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Note01Icon} />
            </EmptyMedia>
            <EmptyTitle>The queue is empty</EmptyTitle>
            <EmptyDescription>
              Add a prompt below. Later, tap it to copy it straight to your
              clipboard, then check it off once it has run.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {open.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Queue clear — everything here has run.
            </p>
          ) : (
            <ul className="space-y-1">{rows(open)}</ul>
          )}

          {/* Finished work sinks below the live queue instead of padding it out. */}
          {done.length > 0 && (
            <>
              <h2 className="mt-8 mb-2 px-2 text-xs font-medium text-muted-foreground">
                Done · {done.length}
              </h2>
              <ul className="space-y-1">{rows(done)}</ul>
            </>
          )}
        </>
      )}
    </ProjectShell>
  )
}

function PromptRow({
  prompt,
  onToggle,
  onDelete,
}: {
  prompt: Prompt
  onToggle: (checked: boolean) => void
  onDelete: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const isPending = prompt.id === PENDING_ID
  const isLong = prompt.text.length > CLAMP_OVER_CHARS
  // Without this every row's icon buttons announce identically, leaving a
  // screen-reader user no way to tell which prompt they are about to act on.
  const preview =
    prompt.text.length > 40 ? `${prompt.text.slice(0, 40)}…` : prompt.text

  async function copy() {
    if (isPending) return
    if (await copyPrompt(prompt.text)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }
  }

  return (
    // Borderless: hover is what separates one row from the next now, so the
    // whole row lights up rather than just the copy target inside it.
    <li
      className={cn(
        'rounded-2xl transition-colors motion-safe:animate-in motion-safe:fade-in hover:bg-muted/40',
        isPending && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-2 p-2">
        <div className="flex size-11 shrink-0 items-center justify-center">
          {isPending ? (
            <Spinner className="text-muted-foreground" />
          ) : (
            <Checkbox
              checked={prompt.done}
              aria-label={prompt.done ? 'Mark as not done' : 'Mark as done'}
              onCheckedChange={(checked) => onToggle(Boolean(checked))}
              // Widens the hit area to 44px without growing the 16px control.
              className="after:-inset-3.5"
            />
          )}
        </div>

        {/* The whole text block copies — that is the app's core action, so it
            gets the largest target. The trailing icon is what signals it. */}
        {/* Deliberately unlabelled: the prompt text is the accessible name, so a
            screen reader reads the content instead of a generic action label. */}
        <button
          type="button"
          onClick={copy}
          disabled={isPending}
          className="min-w-0 flex-1 cursor-pointer rounded-md py-2.5 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 active:bg-muted/60 disabled:cursor-default"
        >
          <span
            className={cn(
              'block text-sm break-words whitespace-pre-wrap',
              !expanded && isLong && 'line-clamp-4',
              prompt.done && 'text-muted-foreground line-through',
            )}
          >
            {prompt.text}
          </span>
        </button>

        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'size-11',
              copied ? 'text-primary' : 'text-muted-foreground',
            )}
            onClick={copy}
            disabled={isPending}
            aria-label={`Copy prompt: ${preview}`}
          >
            <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            disabled={isPending}
            aria-label={`Delete prompt: ${preview}`}
          >
            <HugeiconsIcon icon={Delete02Icon} />
          </Button>
        </div>
      </div>

      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="mb-1 ml-13 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </li>
  )
}

/** Chrome shared by the queue and by its pending / error / not-found states. */
function ProjectShell({
  title,
  composer,
  children,
}: {
  title?: string
  composer?: React.ReactNode
  children: React.ReactNode
}) {
  // Chat-app frame: the shell fills the height the authed layout hands it, so
  // the queue scrolls between a fixed header and a composer on the bottom edge.
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AppHeader>
        {/* From `md` up the sidebar is the way back, and it never left. */}
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 size-11 shrink-0 md:hidden"
          aria-label="Back to projects"
          nativeButton={false}
          render={<Link to="/" />}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} />
        </Button>
        {title && (
          <h1 className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight">
            {title}
          </h1>
        )}
        <ThemeToggle className="-mr-2 ml-auto shrink-0" />
      </AppHeader>
      {/* `div`, not `main`: SidebarInset is already the page's main. The column
          cap is a phone-and-tablet thing — from `md` the queue takes the width
          the sidebar leaves it. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-md px-4 py-4 md:max-w-none md:px-6">
          {children}
        </div>
      </div>
      {composer && (
        // Phone: sits on the bottom edge, under the thumb. Desktop: lifted off
        // it — no safe area to hug there, and no thumb to reach with.
        <div className="bg-background pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-6">
          {/* The queue runs the full width; the field does not — a 1400px input
              is a long way for the eye to travel back on every line. */}
          <div className="mx-auto max-w-md px-4 pt-3 md:max-w-3xl md:px-6">
            {composer}
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectPending() {
  return (
    <ProjectShell
      composer={<Skeleton className="h-13 rounded-4xl" />}
    >
      <div className="space-y-1">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    </ProjectShell>
  )
}

function ProjectError({ reset }: { reset: () => void }) {
  return (
    <ProjectShell>
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={Alert02Icon} />
          </EmptyMedia>
          <EmptyTitle>Couldn't load this queue</EmptyTitle>
          <EmptyDescription>
            The connection dropped or the server is down. Your prompts are safe.
          </EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" onClick={reset} className="h-11">
          <HugeiconsIcon icon={RefreshIcon} />
          Try again
        </Button>
      </Empty>
    </ProjectShell>
  )
}

function ProjectNotFound() {
  return (
    <ProjectShell>
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={Alert02Icon} />
          </EmptyMedia>
          <EmptyTitle>Project not found</EmptyTitle>
          <EmptyDescription>
            It was deleted, or the link belongs to another account.
          </EmptyDescription>
        </EmptyHeader>
        <Button
          variant="outline"
          className="h-11"
          nativeButton={false}
          render={<Link to="/" />}
        >
          Back to projects
        </Button>
      </Empty>
    </ProjectShell>
  )
}
