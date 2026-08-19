import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { toastManager } from "@/components/ui/toast";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  ArrowLeft01Icon,
  Copy01Icon,
  Delete02Icon,
  MoreHorizontalIcon,
  Note01Icon,
  PencilEdit02Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { AppHeader } from "@/components/app-header";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RenameField } from "@/components/rename-field";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useMutate, useOptimisticList } from "@/lib/use-mutate";
import {
  createPromptFn,
  deleteProjectFn,
  deletePromptFn,
  getProjectFn,
  renameProjectFn,
  restorePromptFn,
  togglePromptFn,
} from "@/lib/fns";

export const Route = createFileRoute("/_authed/p/$projectId")({
  loader: ({ params }) => getProjectFn({ data: { id: params.projectId } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.project.name} · toprompt`
          : "toprompt",
      },
    ],
  }),
  pendingComponent: ProjectPending,
  errorComponent: ProjectError,
  notFoundComponent: ProjectNotFound,
  component: ProjectView,
});

type Prompt = Awaited<ReturnType<typeof getProjectFn>>["prompts"][number];

// Only one create can be in flight (the form disables while pending), so a fixed
// id is enough to key the placeholder row and keeps the reducer pure.
const PENDING_ID = "__pending__";

// Before paint on the client, so the queue never flashes at the top on its way
// to the bottom; on the server there is nothing to scroll and useLayoutEffect
// only warns.
const useIsomorphicLayoutEffect =
  typeof document === "undefined" ? useEffect : useLayoutEffect;

type PromptAction =
  | { type: "add"; text: string; at: Date }
  | { type: "toggle"; id: string; done: boolean }
  | { type: "remove"; id: string };

function applyPromptAction(
  prompts: Array<Prompt>,
  action: PromptAction,
): Array<Prompt> {
  switch (action.type) {
    case "add":
      // Appended, not prepended: the newest prompt belongs at the bottom, next
      // to the field that just made it. `at` is stamped by the caller because
      // this runs on every render — a `new Date()` in here would be a new value
      // each time and the row's timestamp would never settle.
      return [
        ...prompts,
        {
          id: PENDING_ID,
          projectId: "",
          text: action.text,
          done: false,
          createdAt: action.at,
        },
      ];
    case "toggle":
      return prompts.map((p) =>
        p.id === action.id ? { ...p, done: action.done } : p,
      );
    case "remove":
      return prompts.filter((p) => p.id !== action.id);
  }
}

async function copyPrompt(text: string) {
  if (!navigator.clipboard) {
    toastManager.add({
      title: "Copying needs a secure (https) connection.",
      type: "error",
    });
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    toastManager.add({
      title: "Couldn't copy — select the text and copy it manually.",
      type: "error",
    });
    return false;
  }
}

function ProjectView() {
  const { project, prompts: loaded } = Route.useLoaderData();
  const navigate = useNavigate();
  // Two of them, not one: a row action must not make the compose form look
  // like it is submitting the draft still sitting in the textarea.
  const [saving, save] = useMutate();
  const [, mutate] = useMutate();
  const [prompts, addOptimistic] = useOptimisticList(loaded, applyPromptAction);
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Renaming swaps the title out from under the ⋯, so the flag lives up here
  // with the title rather than inside the menu that starts it.
  const [renaming, setRenaming] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seen = useRef({ id: "", count: -1 });

  const trimmed = text.trim();

  // Entering a project lands on its newest prompt and *stays* there while the
  // page settles. One scroll on mount is not enough: the web font swaps in and
  // re-wraps every prompt after it, so a cold load ends up parked a screen
  // above the bottom it aimed at. The observer re-pins through all of that,
  // and through the phone keyboard opening under it.
  useIsomorphicLayoutEffect(() => {
    const el = scrollRef.current;
    const content = el?.firstElementChild;
    if (!el || !content) return;

    // Only while the reader is still down there. Read off the scroll position
    // rather than off wheel or touch, because those never fire for a scrollbar
    // drag, a keyboard scroll or a browser's own restore — the position is the
    // one signal every way of moving leaves behind. Scrolling back to the
    // bottom re-arms it.
    let stick = true;
    const onScroll = () => {
      stick = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    };
    const pin = () => {
      if (stick) el.scrollTop = el.scrollHeight;
    };

    pin();
    el.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(pin);
    observer.observe(content);

    return () => {
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [project.id]);

  // Follows every prompt added after that, including once the reader has
  // scrolled away and released the observer above — you wrote it, you should
  // see it land. A delete is the one count change that must leave the view
  // alone: it happens where the user is already looking, which is not
  // necessarily the bottom. Toggling changes no count, so it never runs.
  useIsomorphicLayoutEffect(() => {
    const el = scrollRef.current;
    if (
      el &&
      prompts.length > seen.current.count &&
      seen.current.id === project.id
    )
      el.scrollTop = el.scrollHeight;
    seen.current = { id: project.id, count: prompts.length };
  }, [project.id, prompts.length]);

  function create() {
    if (!trimmed || saving) return;
    setText("");
    // Keeps focus in the field so several prompts can be captured in a row.
    textareaRef.current?.focus();
    save(
      () => createPromptFn({ data: { projectId: project.id, text: trimmed } }),
      {
        error: "Couldn't save that prompt.",
        optimistic: () =>
          addOptimistic({ type: "add", text: trimmed, at: new Date() }),
        onError: () => setText(trimmed),
      },
    );
  }

  function toggle(p: Prompt, done: boolean) {
    mutate(() => togglePromptFn({ data: { id: p.id, done } }), {
      error: "Couldn't update that prompt.",
      optimistic: () => addOptimistic({ type: "toggle", id: p.id, done }),
    });
  }

  /**
   * Tapping the prompt itself. On a fresh one that means copy-and-tick; on one
   * already ticked it only unticks — nothing is put on the clipboard, because
   * the tap that undoes a mistake should not also overwrite what you copied
   * since. The Copy button is the way to re-copy a done prompt.
   */
  function select(p: Prompt) {
    if (p.done) {
      toggle(p, false);
      return;
    }
    copy(p, true);
  }

  /**
   * The clipboard half on its own. Only the prompt tap ticks the box with it —
   * the Copy button is for grabbing the text again without touching where the
   * queue has got to. A failed copy marks nothing.
   */
  async function copy(p: Prompt, mark = false) {
    if (p.id === PENDING_ID || !(await copyPrompt(p.text))) return;
    // Android only: iOS has no Vibration API, and `?.` is the whole of the
    // feature detection this needs.
    navigator.vibrate?.(10);
    toastManager.add({
      title: mark ? "Copied — marked done" : "Copied to clipboard",
      type: "success",
    });
    if (mark) toggle(p, true);
  }

  function remove(p: Prompt) {
    mutate(() => deletePromptFn({ data: { id: p.id } }), {
      error: "Couldn't delete that prompt.",
      optimistic: () => addOptimistic({ type: "remove", id: p.id }),
    });
    // Undo rather than a confirmation dialog: deleting is routine here, and a
    // prompt is long enough to be genuinely painful to retype.
    const toastId = toastManager.add({
      title: "Prompt deleted",
      actionProps: {
        children: "Undo",
        onClick: () => {
          // Base UI leaves the toast up after its action runs.
          toastManager.close(toastId);
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
          );
        },
      },
    });
  }

  function rows(list: Array<Prompt>) {
    return list.map((p) => (
      <PromptRow
        key={p.id}
        prompt={p}
        onSelect={() => select(p)}
        onCopy={() => copy(p)}
        onToggle={(checked) => toggle(p, checked)}
        onDelete={() => remove(p)}
      />
    ));
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
              onSuccess: () => navigate({ to: "/" }),
            })
          }
        />
      }
      scrollRef={scrollRef}
      composer={
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <InputGroup>
            <InputGroupTextarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter breaks the line. isComposing is the
                // guard that matters: committing an IME candidate fires Enter
                // too, and without it a Japanese or Thai draft submits half-typed.
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  create();
                }
              }}
              placeholder="Write a prompt…"
              aria-label="New prompt"
              // Labels the phone keyboard's return key for what it now does.
              enterKeyHint="send"
              maxLength={10000}
              // Prompts run to 10k characters; field-sizing-content (stock)
              // grows the field, this just stops it swallowing the queue above.
              className="max-h-48 overflow-y-auto"
            />
            <InputGroupAddon align="block-end" className="justify-end">
              <Button type="submit" size="sm" disabled={!trimmed || saving}>
                {saving && <Spinner />}
                Add
                <kbd
                  aria-hidden
                  className="ml-1 hidden font-sans text-xs opacity-60 sm:inline"
                >
                  ↵
                </kbd>
              </Button>
            </InputGroupAddon>
          </InputGroup>
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
  );
}

function PromptRow({
  prompt,
  onSelect,
  onCopy,
  onToggle,
  onDelete,
}: {
  prompt: Prompt;
  /** Tapping the prompt: copy-and-tick, or untick a done one without copying. */
  onSelect: () => void;
  onCopy: () => void;
  onToggle: (checked: boolean) => void;
  onDelete: () => void;
}) {
  const isPending = prompt.id === PENDING_ID;
  // Without this every row's icon buttons announce identically, leaving a
  // screen-reader user no way to tell which prompt they are about to act on.
  const preview =
    prompt.text.length > 40 ? `${prompt.text.slice(0, 40)}…` : prompt.text;

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3",
        prompt.done ? "bg-muted/40" : "bg-card",
        isPending && "opacity-64",
      )}
    >
      <div className="pt-0.5">
        {isPending ? (
          <Spinner className="text-muted-foreground" />
        ) : (
          <Checkbox
            checked={prompt.done}
            aria-label={prompt.done ? "Mark as not done" : "Mark as done"}
            onCheckedChange={(checked) => onToggle(Boolean(checked))}
          />
        )}
      </div>

      {/* Deliberately unlabelled: the prompt text is the accessible name, so a
          screen reader reads the content instead of a generic action label. */}
      <button
        type="button"
        aria-pressed={prompt.done}
        onClick={onSelect}
        disabled={isPending}
        className="min-w-0 flex-1 cursor-pointer text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default"
      >
        <span
          className={cn(
            "block text-sm break-words whitespace-pre-wrap select-text",
            prompt.done && "text-muted-foreground line-through",
          )}
        >
          {prompt.text}
        </span>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onCopy}
          disabled={isPending}
          aria-label={`Copy prompt: ${preview}`}
        >
          <HugeiconsIcon icon={Copy01Icon} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hover:text-destructive"
          onClick={onDelete}
          disabled={isPending}
          aria-label={`Delete prompt: ${preview}`}
        >
          <HugeiconsIcon icon={Delete02Icon} />
        </Button>
      </div>
    </li>
  );
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
  name: string;
  total: number;
  /** The rename field, mounted by the time the menu closes — so the caret lands
   *  in the title itself instead of back on the ⋯ the user just left. */
  finalFocus: React.RefObject<HTMLInputElement | null>;
  onRename: () => void;
  onDelete: () => void;
}) {
  // The menu can't own the dialog: Base UI unmounts the menu popup on close,
  // which would take a dialog rendered inside it down with it.
  const [confirming, setConfirming] = useState(false);

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
            ? "This project is empty. Deleting it cannot be undone."
            : `Its ${total} ${total === 1 ? "prompt is" : "prompts are"} deleted with it. This cannot be undone.`
        }
        confirmLabel="Delete project"
        onConfirm={onDelete}
      />
    </>
  );
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
  title?: React.ReactNode;
  /** Trails the topbar. Only the loaded queue has a project to act on. */
  actions?: React.ReactNode;
  composer?: React.ReactNode;
  /** The transcript's viewport, so the queue can open on its newest entry. */
  scrollRef?: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
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
          className={cn("ml-auto shrink-0 md:hidden", !actions && "-mr-2")}
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
  );
}

function ProjectPending() {
  return (
    <ProjectShell composer={<Skeleton className="h-24 rounded-lg" />}>
      {/* Traces the loaded rows — same border, same padding, same column
          width — so nothing shifts when the real ones land. */}
      <div className="space-y-2">
        {[70, 45, 60].map((width, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border p-3">
            <Skeleton className="size-4.5 shrink-0 rounded-[.25rem] sm:size-4" />
            <Skeleton className="h-4 flex-1" style={{ maxWidth: `${width}%` }} />
          </div>
        ))}
      </div>
    </ProjectShell>
  );
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
  );
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
        <Button variant="outline" className="h-11" render={<Link to="/" />}>
          Back to projects
        </Button>
      </Empty>
    </ProjectShell>
  );
}
