import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Alert02Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  Copy01Icon,
  Delete02Icon,
  MoreHorizontalIcon,
  Note01Icon,
  PencilEdit02Icon,
  RefreshIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { AppHeader } from '@/components/app-header'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { RenameField } from '@/components/rename-field'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useMutate, useOptimisticList } from '@/lib/use-mutate'
import {
  createPromptFn,
  deleteProjectFn,
  deletePromptFn,
  getProjectFn,
  renameProjectFn,
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

// Before paint on the client, so the queue never flashes at the top on its way
// to the bottom; on the server there is nothing to scroll and useLayoutEffect
// only warns.
const useIsomorphicLayoutEffect =
  typeof document === 'undefined' ? useEffect : useLayoutEffect

// Reading the queue on the server would put it in the server's timezone and
// locale; the reader is in neither. Built once, used by every stamp.
const AT_TIME = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
})
const AT_DATE = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

// The client-only half of the same problem: a server-rendered 03:12 hydrating
// into 10:12 is a text mismatch, and React's only recovery from one is to throw
// the hydrated tree away and re-render the root. So the stamp lands on mount,
// against a reserved width so the footer doesn't reflow when it does.
function Stamp({ at }: { at: Date }) {
  const iso = new Date(at).toISOString()
  const [label, setLabel] = useState('')

  useEffect(() => {
    const on = new Date(iso)
    setLabel(
      on.toDateString() === new Date().toDateString()
        ? AT_TIME.format(on)
        : AT_DATE.format(on),
    )
  }, [iso])

  return (
    <time dateTime={iso} className="min-w-11 shrink-0 tabular-nums">
      {label}
    </time>
  )
}

type PromptAction =
  | { type: 'add'; text: string; at: Date }
  | { type: 'toggle'; id: string; done: boolean }
  | { type: 'remove'; id: string }

function applyPromptAction(
  prompts: Array<Prompt>,
  action: PromptAction,
): Array<Prompt> {
  switch (action.type) {
    case 'add':
      // Appended, not prepended: the newest prompt belongs at the bottom, next
      // to the field that just made it. `at` is stamped by the caller because
      // this runs on every render — a `new Date()` in here would be a new value
      // each time and the row's timestamp would never settle.
      return [
        ...prompts,
        {
          id: PENDING_ID,
          projectId: '',
          text: action.text,
          done: false,
          createdAt: action.at,
        },
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
    return true
  } catch {
    toast.error("Couldn't copy — select the text and copy it manually.")
    return false
  }
}

function ProjectView() {
  const { project, prompts: loaded } = Route.useLoaderData()
  const navigate = useNavigate()
  // Two of them, not one: a row action must not make the compose form look
  // like it is submitting the draft still sitting in the textarea.
  const [saving, save] = useMutate()
  const [, mutate] = useMutate()
  const [prompts, addOptimistic] = useOptimisticList(loaded, applyPromptAction)
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Renaming swaps the title out from under the ⋯, so the flag lives up here
  // with the title rather than inside the menu that starts it.
  const [renaming, setRenaming] = useState(false)
  const renameRef = useRef<HTMLInputElement>(null)
  // One row at a time can be the last one copied, so the flag and its timer
  // live here rather than in every row — the previous row drops back the moment
  // the next one is taken.
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )
  const scrollRef = useRef<HTMLDivElement>(null)
  const seen = useRef({ id: '', count: -1 })

  const trimmed = text.trim()

  // Entering a project lands on its newest prompt and *stays* there while the
  // page settles. One scroll on mount is not enough: the web font swaps in and
  // re-wraps every prompt after it, so a cold load ends up parked a screen
  // above the bottom it aimed at. The observer re-pins through all of that,
  // and through the phone keyboard opening under it.
  useIsomorphicLayoutEffect(() => {
    const el = scrollRef.current
    const content = el?.firstElementChild
    if (!el || !content) return

    // Only while the reader is still down there. Read off the scroll position
    // rather than off wheel or touch, because those never fire for a scrollbar
    // drag, a keyboard scroll or a browser's own restore — the position is the
    // one signal every way of moving leaves behind. Scrolling back to the
    // bottom re-arms it.
    let stick = true
    const onScroll = () => {
      stick = el.scrollHeight - el.scrollTop - el.clientHeight < 32
    }
    const pin = () => {
      if (stick) el.scrollTop = el.scrollHeight
    }

    pin()
    el.addEventListener('scroll', onScroll, { passive: true })
    const observer = new ResizeObserver(pin)
    observer.observe(content)

    return () => {
      el.removeEventListener('scroll', onScroll)
      observer.disconnect()
    }
  }, [project.id])

  // Follows every prompt added after that, including once the reader has
  // scrolled away and released the observer above — you wrote it, you should
  // see it land. A delete is the one count change that must leave the view
  // alone: it happens where the user is already looking, which is not
  // necessarily the bottom. Toggling changes no count, so it never runs.
  useIsomorphicLayoutEffect(() => {
    const el = scrollRef.current
    if (el && prompts.length > seen.current.count && seen.current.id === project.id)
      el.scrollTop = el.scrollHeight
    seen.current = { id: project.id, count: prompts.length }
  }, [project.id, prompts.length])

  function create() {
    if (!trimmed || saving) return
    setText('')
    // Keeps focus in the field so several prompts can be captured in a row.
    textareaRef.current?.focus()
    save(() => createPromptFn({ data: { projectId: project.id, text: trimmed } }), {
      error: "Couldn't save that prompt.",
      optimistic: () =>
        addOptimistic({ type: 'add', text: trimmed, at: new Date() }),
      onError: () => setText(trimmed),
    })
  }

  function toggle(p: Prompt, done: boolean) {
    mutate(() => togglePromptFn({ data: { id: p.id, done } }), {
      error: "Couldn't update that prompt.",
      optimistic: () => addOptimistic({ type: 'toggle', id: p.id, done }),
    })
  }

  /**
   * Tapping the prompt itself. On a fresh one that means copy-and-tick; on one
   * already ticked it only unticks — nothing is put on the clipboard, because
   * the tap that undoes a mistake should not also overwrite what you copied
   * since. The Copy button is the way to re-copy a done prompt.
   */
  function select(p: Prompt) {
    if (p.done) {
      toggle(p, false)
      return
    }
    copy(p, true)
  }

  /**
   * The clipboard half on its own. Only the prompt tap ticks the box with it —
   * the Copy button is for grabbing the text again without touching where the
   * queue has got to. A failed copy marks nothing.
   */
  async function copy(p: Prompt, mark = false) {
    if (p.id === PENDING_ID || !(await copyPrompt(p.text))) return
    // The phone answers the gesture itself rather than leaving the toast to do
    // it — a swipe lands with the finger still on the glass, which is the one
    // moment a tick that appears somewhere else is easy to miss. Android only:
    // iOS has no Vibration API, and `?.` is the whole of the feature detection
    // this needs.
    navigator.vibrate?.(10)
    // Says both halves of what just happened — the checkbox ticking on its own
    // is the surprising one. Sonner's own live region announces it, so the row
    // does not carry a second one.
    toast.success(mark ? 'Copied — marked done' : 'Copied to clipboard')
    setCopiedId(p.id)
    // Cleared first so copying a second prompt doesn't inherit the remainder of
    // the first one's window and blink off early.
    clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopiedId(null), 1600)
    if (mark) toggle(p, true)
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
        copied={copiedId === p.id}
        onSelect={() => select(p)}
        onCopy={() => copy(p)}
        onToggle={(checked) => toggle(p, checked)}
        onDelete={() => remove(p)}
      />
    ))
  }

  return (
    <ProjectShell
      title={
        renaming ? (
          <RenameField
            ref={renameRef}
            name={project.name}
            onRename={(name) =>
              mutate(
                () => renameProjectFn({ data: { id: project.id, name } }),
                { error: `Couldn't rename “${project.name}”.` },
              )
            }
            onClose={() => setRenaming(false)}
            // The heading's own type, in the heading's own lane — only the
            // control changes, not the name's size or weight.
            className="h-11 rounded-2xl px-3 text-xl font-bold tracking-tight md:text-xl"
          />
        ) : (
          <h1 className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight">
            {project.name}
          </h1>
        )
      }
      actions={
        <ProjectMenu
          name={project.name}
          total={prompts.length}
          finalFocus={renameRef}
          onRename={() => setRenaming(true)}
          onDelete={() =>
            mutate(() => deleteProjectFn({ data: { id: project.id } }), {
              error: `Couldn't delete “${project.name}”.`,
              // Leave before the refetch: the queue on screen is the one just
              // deleted, and its loader answers not found.
              onSuccess: () => navigate({ to: '/' }),
            })
          }
        />
      }
      scrollRef={scrollRef}
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
              // Enter sends, Shift+Enter breaks the line. isComposing is the
              // guard that matters: committing an IME candidate fires Enter
              // too, and without it a Japanese or Thai draft submits half-typed.
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault()
                create()
              }
            }}
            placeholder="Write a prompt…"
            aria-label="New prompt"
            // Labels the phone keyboard's return key for what it now does.
            enterKeyHint="send"
            maxLength={10000}
            // The project-name pill, still a textarea: prompts arrive multi-line
            // and run to 10k characters. field-sizing-content grows it, max-h-48
            // stops it swallowing the queue above. pr-* is the button's lane —
            // without it a long line types straight under the button.
            className="max-h-48 min-h-14 overflow-y-auto rounded-4xl py-3.5 pr-22 pl-5 sm:pr-28 md:min-h-13 md:text-base"
          />
          {/* Bottom-anchored, so it stays put as the field grows. A full 44px
              on a phone — this is the one control the whole screen is aimed at
              — and the field's min height carries the extra 4px with it so the
              button keeps its 6px of surround at either size. */}
          <Button
            type="submit"
            className="absolute right-1.5 bottom-1.5 h-11 px-4 md:h-10"
            disabled={!trimmed || saving}
          >
            {saving && <Spinner />}
            Add
            <kbd
              aria-hidden
              className="ml-1 hidden font-sans text-xs opacity-60 sm:inline"
            >
              ↵
            </kbd>
          </Button>
        </form>
      }
    >
      {prompts.length === 0 ? (
        // my-auto against the shell's justify-end: the transcript sits on the
        // composer, but an empty one has nothing to sit on and centres instead.
        <Empty className="my-auto">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Note01Icon} />
            </EmptyMedia>
            <EmptyTitle>The queue is empty</EmptyTitle>
            <EmptyDescription>
              Add a prompt below. Tap it later to copy it to your clipboard — it
              checks itself off as it goes.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        // One list in the order things were written, done or not. Sorting the
        // finished ones out of the way would move a prompt the moment it was
        // copied, and the position in the queue is how you find it again.
        <ul className="space-y-2">{rows(prompts)}</ul>
      )}
    </ProjectShell>
  )
}

// Past this much travel a release commits the action instead of springing
// back. Far enough that a scroll which drifted sideways never reaches it,
// close enough to flick without a second thought.
const SWIPE_COMMIT = 88

// Where the row stops following the finger 1:1 and starts resisting, so a long
// drag reads as "there is nothing further this way" rather than as the row
// coming off its rails.
const SWIPE_LIMIT = SWIPE_COMMIT * 1.4

function resist(dx: number) {
  const past = Math.abs(dx) - SWIPE_LIMIT
  return past <= 0 ? dx : Math.sign(dx) * (SWIPE_LIMIT + past * 0.3)
}

/**
 * Horizontal drag on a row, with the two actions it uncovers.
 *
 * Touch only, deliberately: a pointer has the buttons, and reading
 * `pointerType` rather than a breakpoint means a touchscreen laptop gets the
 * gesture without the app having to infer input from width.
 *
 * The axis is decided once, on the first 8px of movement, and never revisited.
 * Until then the browser is still free to take the gesture as a scroll — which
 * is what `touch-action: pan-y` on the row leaves it — and once the answer is
 * `y` this hook is out of the way for the rest of the gesture. Getting that
 * wrong in either direction is the difference between a list that scrolls and
 * one that fights back.
 */
function useSwipe({
  onLeft,
  onRight,
  enabled,
}: {
  onLeft: () => void
  onRight: () => void
  enabled: boolean
}) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const from = useRef<{ x: number; y: number; axis: 'ask' | 'x' | 'y' } | null>(
    null,
  )
  // A drag still ends in a click, delivered to whatever the finger came down
  // on. This is what stops that click ticking the checkbox it started from.
  const swiped = useRef(false)

  function settle() {
    const gesture = from.current
    from.current = null
    setDragging(false)
    setDx(0)
    if (gesture?.axis !== 'x') return
    if (dx <= -SWIPE_COMMIT) onLeft()
    else if (dx >= SWIPE_COMMIT) onRight()
  }

  const handlers = enabled
    ? {
        onPointerDown(e: React.PointerEvent) {
          if (e.pointerType !== 'touch') return
          from.current = { x: e.clientX, y: e.clientY, axis: 'ask' }
          swiped.current = false
        },
        onPointerMove(e: React.PointerEvent) {
          const gesture = from.current
          if (!gesture) return
          const moved = { x: e.clientX - gesture.x, y: e.clientY - gesture.y }
          if (gesture.axis === 'ask') {
            if (Math.abs(moved.x) < 8 && Math.abs(moved.y) < 8) return
            if (Math.abs(moved.y) >= Math.abs(moved.x)) {
              from.current = null
              return
            }
            gesture.axis = 'x'
            // Keeps the rest of the gesture coming here even once the finger
            // has left the row it started on.
            e.currentTarget.setPointerCapture(e.pointerId)
            setDragging(true)
          }
          swiped.current = true
          setDx(resist(moved.x))
        },
        onPointerUp: settle,
        onPointerCancel: settle,
        // Capture, on the container: every control in the row is downstream of
        // here, so one guard covers the checkbox, the prompt and Show all
        // rather than each of them learning about swiping.
        onClickCapture(e: React.MouseEvent) {
          if (!swiped.current) return
          swiped.current = false
          e.preventDefault()
          e.stopPropagation()
        },
      }
    : {}

  return { dx, dragging, handlers }
}

function PromptRow({
  prompt,
  copied,
  onSelect,
  onCopy,
  onToggle,
  onDelete,
}: {
  prompt: Prompt
  copied: boolean
  /** Tapping the prompt: copy-and-tick, or untick a done one without copying. */
  onSelect: () => void
  onCopy: () => void
  onToggle: (checked: boolean) => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isPending = prompt.id === PENDING_ID
  const isLong = prompt.text.length > CLAMP_OVER_CHARS
  // Without this every row's icon buttons announce identically, leaving a
  // screen-reader user no way to tell which prompt they are about to act on.
  const preview =
    prompt.text.length > 40 ? `${prompt.text.slice(0, 40)}…` : prompt.text

  const swipe = useSwipe({
    onLeft: onDelete,
    // Copy without ticking, which is exactly what the Copy button did — tapping
    // the prompt is the one that also marks it done. Keeping the two gestures
    // distinct is the whole reason both exist.
    onRight: onCopy,
    enabled: !isPending,
  })

  // One pair, rendered into whichever lane the width has room for: beside the
  // text from `md` up, down in the footer below it. The lane that isn't in use
  // is `display: none`, so neither the tab order nor a screen reader ever meets
  // the second copy.
  //
  // On touch the footer pair goes `sr-only` instead of away: the swipe replaces
  // them for anyone who can swipe, and a gesture is not an affordance
  // VoiceOver or TalkBack can offer, so the buttons stay in the accessibility
  // tree and come back visible the moment anything in the row takes keyboard
  // focus.
  const actions = (
    <>
      {/* The word, not just the tick — the checkbox ticking itself says
          "done", and this is what says the clipboard was the reason. It
          grows into the lane beside it rather than pushing Delete: the target
          you just missed should not slide under the finger that missed
          it. */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'h-11',
          copied
            ? 'w-auto gap-1.5 px-3 text-foreground'
            : 'w-11 text-muted-foreground',
        )}
        onClick={onCopy}
        disabled={isPending}
        aria-label={`Copy prompt: ${preview}`}
      >
        {/* Keyed so the tick fades in as its own element rather than the
            copy glyph mutating in place. */}
        <HugeiconsIcon
          key={copied ? 'copied' : 'idle'}
          icon={copied ? Tick02Icon : Copy01Icon}
          className="size-5 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-75 md:size-4"
        />
        {copied && (
          <span className="text-xs motion-safe:animate-in motion-safe:fade-in">
            Copied
          </span>
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-11 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        disabled={isPending}
        aria-label={`Delete prompt: ${preview}`}
      >
        <HugeiconsIcon icon={Delete02Icon} className="size-5 md:size-4" />
      </Button>
    </>
  )

  return (
    // Its own bubble, spanning the column: the gap between two of them is what
    // separates one prompt from the next, and a shared left and right edge is
    // what lets the eye run the checkboxes and the actions as two straight
    // lines. Rising into place matches where new ones arrive from.
    //
    // The whole bubble lights up, not just the copy target inside it. The
    // copied tint holds for the same beat as the tick and then eases out, so
    // it has to be visible without being loud — primary is the neutral ink
    // token here, so 6% of it reads as a wash in both themes rather than as a
    // coloured alert.
    <li
      className={cn(
        'relative overflow-hidden rounded-2xl border motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2',
        isPending && 'opacity-60',
      )}
    >
      {/* What the drag uncovers, one action per half. The row slides over the
          top, so only the side being pulled from is ever on screen and neither
          needs to be shown or hidden as the finger moves. aria-hidden because
          these are a rendering of the two buttons below, not two more of
          them. */}
      <div
        aria-hidden
        className="absolute inset-0 flex text-sm font-medium select-none"
      >
        <span className="flex flex-1 items-center gap-2 bg-primary/10 px-5">
          <HugeiconsIcon icon={Copy01Icon} className="size-5" />
          Copy
        </span>
        <span className="flex flex-1 items-center justify-end gap-2 bg-destructive/10 px-5 text-destructive">
          Delete
          <HugeiconsIcon icon={Delete02Icon} className="size-5" />
        </span>
      </div>

      {/* The layer that actually moves. It carries the bubble's fill, because
          the fill is what has to travel for anything to be uncovered.
          touch-pan-y hands vertical scrolling straight back to the browser and
          keeps only the horizontal for the drag.

          Three fills, in the order they outrank each other. A done prompt drops
          off the card onto the muted surface — the strike-through is a detail
          you read, the fill is what the eye sorts the column by from a scroll
          away, and hovering one lifts it back toward the card it came from,
          which is what tapping it does. Copied wins over both for its beat and
          then eases into whichever the row has become. */}
      <div
        {...swipe.handlers}
        style={{
          transform: `translate3d(${swipe.dx}px, 0, 0)`,
          // Written here rather than as classes because two properties want
          // two durations, and `transition-*` utilities would merge into one.
          // Follows the finger with no easing at all, eases on the way home.
          // The reduced-motion override in the stylesheet is `!important`, so
          // it still outranks this.
          transition: swipe.dragging
            ? 'background-color 300ms'
            : 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), background-color 300ms',
        }}
        className={cn(
          'relative touch-pan-y',
          copied
            ? 'bg-primary/6'
            : prompt.done
              ? 'bg-muted hover:bg-muted/70'
              : 'bg-card hover:bg-muted/40',
        )}
      >
        {/* Every lane is 44px tall and the text's first line centres on 22px with
          it, so the checkbox, the copy target and — from `md`, where they share
          this row — both icons sit on one optical line no matter how many lines
          the prompt runs to. */}
        <div className="flex items-start gap-2 px-2 pr-3 pt-1.5 md:pr-2">
          <div className="flex size-11 shrink-0 items-center justify-center">
            {isPending ? (
              <Spinner className="text-muted-foreground" />
            ) : (
              <Checkbox
                checked={prompt.done}
                aria-label={prompt.done ? 'Mark as not done' : 'Mark as done'}
                onCheckedChange={(checked) => onToggle(Boolean(checked))}
                // Widens the hit area to 44px without growing the control — the
                // inset is the difference, so the box and its padding stay a
                // 44px square at either size. 20px on a phone, where the tick is
                // aimed at with a thumb rather than a cursor.
                className="size-5 after:-inset-3 md:size-4 md:after:-inset-3.5"
              />
            )}
          </div>

          {/* The whole text block copies — that is the app's core action, so it
            gets the largest target. The trailing icon is what signals it. Once
            it is done the same target reverses it instead, which is why it
            carries a state, not a verb. */}
          {/* Deliberately unlabelled: the prompt text is the accessible name, so a
            screen reader reads the content instead of a generic action label. */}
          <button
            type="button"
            aria-pressed={prompt.done}
            onClick={onSelect}
            disabled={isPending}
            className="min-w-0 flex-1 cursor-pointer rounded-lg py-3 text-left outline-none transition-opacity focus-visible:ring-[3px] focus-visible:ring-ring/50 active:opacity-70 disabled:cursor-default"
          >
            {/* Capped at a reading measure. The column is 768px wide now; prompt
              text is prose, and prose set to 100ch loses the line it is on.
              16px of it on a phone against 14px from `md`: this is the content
              the app exists to hold, and 14px is the density of a sidebar
              label, not of the thing you came to read. */}
            <span
              className={cn(
                // select-text against the touch-wide `user-select: none`: this is
                // the one string on the page worth holding a finger on, and the
                // clipboard's failure message sends you here to do it.
                'block max-w-[68ch] text-base break-words whitespace-pre-wrap select-text md:text-sm',
                !expanded && isLong && 'line-clamp-4',
                prompt.done && 'text-muted-foreground line-through',
              )}
            >
              {prompt.text}
            </span>
          </button>

          <div className="hidden shrink-0 items-center md:flex">{actions}</div>
        </div>

        {/* pl-13 lands the footer on the text's left edge — when it was written,
          and the control that unfolds it, belong to the block above rather than
          to the bubble's outer padding. The pending row has no time yet: it is
          being written as you look at it.
          A fixed height rather than padding: the stamp arrives one tick after
          mount, and an empty <time> in an auto-height row collapses it, so
          every bubble would grow ~17px right after the queue had already been
          scrolled to what was then the bottom.
          Three of those heights. 44px below `md`, where the row actions live
          down here; 32px once the device is a touch one and the swipe has
          taken them away, leaving the stamp on its own — unless the prompt is
          long, because then Show all is still a target in this row; and 28px
          from `md`, where the footer is only ever the stamp. The `max-md`
          prefix keeps the touch rule and the `md` rule in media queries that
          cannot both match, so a touch tablet is not left to source order. */}
        <div
          className={cn(
            'flex h-11 items-center gap-1 pr-1 pl-13 text-xs text-muted-foreground md:h-7 md:pr-3 md:text-[11px]',
            !isLong && 'max-md:pointer-coarse:h-8',
            // Anything in the row taking keyboard focus gives the pair its space
            // back, so the focus ring never lands on something invisible.
            'max-md:pointer-coarse:has-[:focus-visible]:h-11',
          )}
        >
          {!isPending && <Stamp at={prompt.createdAt} />}
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              aria-expanded={expanded}
              className="-my-1 flex items-center gap-1 rounded-lg px-2 py-2.5 font-medium outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 md:px-1.5 md:py-1"
            >
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                className={cn(
                  'size-3.5 transition-transform',
                  expanded && 'rotate-180',
                )}
              />
              {/* The count is what the label is *for* on a wide screen; on a
                phone it is the half that pushes the control under the actions
                now sharing this row, and "Show all" already says the thing. */}
              {expanded ? (
                'Show less'
              ) : (
                <>
                  <span className="md:hidden">Show all</span>
                  <span className="hidden md:inline">
                    Show all {prompt.text.length} characters
                  </span>
                </>
              )}
            </button>
          )}
          <div className="ml-auto flex items-center md:hidden pointer-coarse:sr-only pointer-coarse:focus-within:not-sr-only">
            {actions}
          </div>
        </div>
      </div>
    </li>
  )
}

/**
 * The queue's own ⋯ — the same actions the sidebar row carries, for the project
 * you are already inside. Below `md` the sidebar is a sheet with nothing on
 * screen to open it; above it, the queue you are reading should not cost a trip
 * back to the list to be renamed.
 */
function ProjectMenu({
  name,
  total,
  finalFocus,
  onRename,
  onDelete,
}: {
  name: string
  total: number
  /** The rename field, mounted by the time the menu closes — so the caret lands
   *  in the title itself instead of back on the ⋯ the user just left. */
  finalFocus: React.RefObject<HTMLInputElement | null>
  onRename: () => void
  onDelete: () => void
}) {
  // The menu can't own the dialog: Base UI unmounts the menu popup on close,
  // which would take a dialog rendered inside it down with it.
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${name}`}
          render={
            <Button
              variant="ghost"
              size="icon"
              className="-mr-2 size-11 shrink-0"
            />
          }
        >
          <HugeiconsIcon
            icon={MoreHorizontalIcon}
            className="size-5 md:size-4"
          />
        </DropdownMenuTrigger>
        {/* Hangs off the right edge it sits on, rather than off the screen. */}
        <DropdownMenuContent align="end" finalFocus={finalFocus}>
          <DropdownMenuItem onClick={onRename}>
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
        title={`Delete “${name}”?`}
        description={
          total === 0
            ? 'This project is empty. Deleting it cannot be undone.'
            : `Its ${total} ${total === 1 ? 'prompt is' : 'prompts are'} deleted with it. This cannot be undone.`
        }
        confirmLabel="Delete project"
        onConfirm={onDelete}
      />
    </>
  )
}

/** Chrome shared by the queue and by its pending / error / not-found states. */
function ProjectShell({
  title,
  actions,
  composer,
  scrollRef,
  children,
}: {
  /** The heading itself, not just its text: renaming swaps it for a field. */
  title?: React.ReactNode
  /** Trails the topbar. Only the loaded queue has a project to act on. */
  actions?: React.ReactNode
  composer?: React.ReactNode
  /** The transcript's viewport, so the queue can open on its newest entry. */
  scrollRef?: React.Ref<HTMLDivElement>
  children: React.ReactNode
}) {
  // Chat-app frame: the shell fills the height the authed layout hands it, so
  // the queue scrolls between a fixed header and a composer on the bottom edge.
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The queue's own cap, not the home list's: below `md` the bar would
          otherwise sit 448px wide over a column running the full width. */}
      <AppHeader className="max-w-3xl">
        {/* From `md` up the sidebar is the way back, and it never left. */}
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 size-11 shrink-0 md:hidden"
          aria-label="Back to projects"
          nativeButton={false}
          render={<Link to="/" />}
        >
          {/* Phone-only button, so no `md` half to it: back is the one control
              you aim at without looking. */}
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-6" />
        </Button>
        {title}
        {/* Phone only. From `md` the sidebar is on screen and carries the
            switch next to its own trigger; below it the sidebar is a sheet
            with nothing to open it, so the topbar keeps one. Whichever control
            ends up last owns the edge inset. */}
        <ThemeToggle
          className={cn('ml-auto shrink-0 md:hidden', !actions && '-mr-2')}
        />
        {actions}
      </AppHeader>
      {/* `div`, not `main`: SidebarInset is already the page's main. One cap at
          every width — the queue and the composer below it share an edge, so
          the column reads as a single object rather than two stacked ones. */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {/* justify-end on a full-height column: a short queue rests on the
            composer the way a short chat does, instead of hanging from the
            header with the gap below it. A long one just overflows upward. */}
        <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-end px-4 py-4 md:px-6">
          {children}
        </div>
      </div>
      {composer && (
        // Phone: sits on the bottom edge, under the thumb. Desktop: lifted off
        // it — no safe area to hug there, and no thumb to reach with.
        //
        // Half the bottom inset, not all of it. The full one is the whole
        // home-indicator zone, which under a field that is meant to be on the
        // edge leaves a band of nothing three times the 12px above it. Half
        // clears the indicator bar, which is the only thing down there.
        <div className="bg-background pb-[max(0.75rem,calc(env(safe-area-inset-bottom)/2))] md:pb-6">
          {/* Same cap as the queue above it, so the field's edges line up with
              the rows it is adding to. */}
          <div className="mx-auto max-w-3xl px-4 pt-3 md:px-6">{composer}</div>
        </div>
      )}
    </div>
  )
}

function ProjectPending() {
  return (
    <ProjectShell composer={<Skeleton className="h-14 rounded-4xl md:h-13" />}>
      {/* Traces the loaded bubbles — same border, same lanes, same column
          width, and the same footer lane under them — so nothing shifts when
          the real ones land. */}
      <div className="space-y-2">
        {[70, 45, 60].map((width, i) => (
          <div key={i} className="rounded-2xl border px-2 pt-1.5">
            <div className="flex h-11 items-center gap-2">
              <div className="flex size-11 shrink-0 items-center justify-center">
                <Skeleton className="size-5 rounded-[6px] md:size-4" />
              </div>
              <Skeleton
                className="h-3.5 flex-1"
                style={{ maxWidth: `${width}%` }}
              />
            </div>
            {/* The stamp's lane — and on a phone the row actions' lane too. */}
            <div className="h-11 md:h-7" />
          </div>
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
