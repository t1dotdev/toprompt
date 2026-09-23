import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Folder01Icon, Note01Icon, PinIcon } from '@hugeicons/core-free-icons'
import {
  Command,
  CommandCollection,
  CommandCreateHandle,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from '@/components/ui/command'
import { toastManager } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { type ProjectSummary, listPromptsFn } from '@/lib/fns'
import { excerpt, matches } from '@/lib/search'

/**
 * Module-level so the controls that open the palette — the sidebar's row, the
 * phone topbar's button — can sit anywhere in the tree as detached triggers,
 * without the layout threading an `open` setter down to each of them.
 */
export const searchHandle = CommandCreateHandle()

type Prompts = Awaited<ReturnType<typeof listPromptsFn>>

type Item = {
  /** The row's id — a project's or a prompt's. */
  value: string
  /** A project's name, or a prompt's text with its whitespace collapsed so a
   *  multi-line prompt reads on the one line a result gets. */
  label: string
  /** `label` lowercased once, so a keystroke costs an `includes` per row. */
  search: string
  projectId: string
  /** What trails the row: the project a prompt lives in, or how much is still
   *  waiting in a project. */
  hint: string
  prompt?: { done: boolean }
  pinned?: boolean
}

type Group = { value: string; items: Array<Item> }

/**
 * ⌘K / Ctrl+K. Projects come from the layout's loader, which is already on the
 * page; prompts are fetched when the palette opens, so the list is as fresh as
 * the moment it was asked for and nothing is loaded for a palette never opened.
 */
export function SearchPalette({ projects }: { projects: Array<ProjectSummary> }) {
  const navigate = useNavigate()
  // Kept across opens: the second time round the last answer is on screen while
  // the new one loads.
  const [prompts, setPrompts] = useState<Prompts>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey)) return
      // Ctrl+K is the address bar's search in Firefox.
      e.preventDefault()
      if (searchHandle.isOpen) searchHandle.close()
      else searchHandle.open(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const groups = useMemo<Array<Group>>(() => {
    const names = new Map(projects.map((p) => [p.id, p.name]))
    return [
      {
        value: 'Projects',
        items: projects.map((p) => ({
          value: p.id,
          label: p.name,
          search: p.name.toLowerCase(),
          projectId: p.id,
          hint: p.open > 0 ? String(p.open) : '',
          pinned: p.pinned,
        })),
      },
      {
        value: 'Prompts',
        items: prompts.map((p) => {
          const label = p.text.replace(/\s+/g, ' ')
          return {
            value: p.id,
            label,
            search: label.toLowerCase(),
            projectId: p.projectId,
            hint: names.get(p.projectId) ?? '',
            prompt: { done: p.done },
          }
        }),
      },
    ]
  }, [projects, prompts])

  function go(item: Item) {
    searchHandle.close()
    navigate({
      to: '/p/$projectId',
      params: { projectId: item.projectId },
      // The queue scrolls to the row carrying this id and marks it.
      hash: item.prompt ? item.value : undefined,
    })
  }

  return (
    <CommandDialog
      handle={searchHandle}
      onOpenChange={(open) => {
        if (!open) return
        setQuery('')
        listPromptsFn()
          .then(setPrompts)
          .catch(() =>
            toastManager.add({
              title: "Couldn't load your prompts — only projects are searchable.",
              type: 'error',
            }),
          )
      }}
    >
      <CommandDialogPopup aria-label="Search">
        {/* One cap across both groups, projects first: an empty query reads as
            the project list with the newest prompts under it, and no query can
            ask the list to draw a whole history. */}
        <Command
          items={groups}
          filter={matches}
          limit={50}
          value={query}
          onValueChange={setQuery}
        >
          <CommandInput
            placeholder="Search projects and prompts…"
            aria-label="Search projects and prompts"
            onKeyDown={(e) => {
              // Ctrl+N / Ctrl+P step through the results like ↓ / ↑, as in
              // Emacs and most palettes. Base UI only navigates on the arrows,
              // so the chord is replayed as one. Left alone mid-IME, where it
              // can belong to the candidate window.
              const key = e.key.toLowerCase()
              const arrow =
                key === 'n' ? 'ArrowDown' : key === 'p' ? 'ArrowUp' : null
              if (!arrow || !e.ctrlKey || e.nativeEvent.isComposing) return
              // Otherwise macOS jumps the caret to either end, and Ctrl+P prints
              // everywhere else.
              e.preventDefault()
              e.currentTarget.dispatchEvent(
                new KeyboardEvent('keydown', { key: arrow, bubbles: true }),
              )
            }}
          />
          <CommandPanel>
            <CommandEmpty>Nothing matches “{query.trim()}”.</CommandEmpty>
            <CommandList>
              {(group: Group) => (
                <CommandGroup key={group.value} items={group.items}>
                  <CommandGroupLabel>{group.value}</CommandGroupLabel>
                  <CommandCollection>
                    {(item: Item) => (
                      <CommandItem
                        key={item.value}
                        value={item}
                        onClick={() => go(item)}
                        className="gap-2"
                      >
                        <HugeiconsIcon
                          icon={
                            item.prompt
                              ? Note01Icon
                              : item.pinned
                                ? PinIcon
                                : Folder01Icon
                          }
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate',
                            item.prompt?.done &&
                              'text-muted-foreground line-through',
                          )}
                        >
                          {item.prompt ? excerpt(item, query) : item.label}
                        </span>
                        {item.hint && (
                          <span className="max-w-32 shrink-0 truncate text-xs tabular-nums text-muted-foreground">
                            {item.hint}
                          </span>
                        )}
                      </CommandItem>
                    )}
                  </CommandCollection>
                </CommandGroup>
              )}
            </CommandList>
          </CommandPanel>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  )
}
