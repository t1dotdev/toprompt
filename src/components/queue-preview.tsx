import { HugeiconsIcon } from '@hugeicons/react'
import { Copy01Icon, Tick02Icon } from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

/**
 * The product, three rows tall. A queue being emptied top-down: one prompt
 * finished, one on the clipboard this second, one still waiting. Static and
 * aria-hidden — it is an illustration built from the app's own vocabulary, not
 * a control — and it earns its place by answering "what is this?" before the
 * headline has to.
 *
 * Shared by the landing hero and the login screen: the two places a visitor
 * meets the product before they have a queue of their own.
 */
export function QueuePreview({ className }: { className?: string }) {
  const rows = [
    { text: 'Add optimistic updates to the queue mutations', state: 'done' },
    { text: 'Write a migration for the pinned column', state: 'copied' },
    { text: 'Refactor the sidebar into a compound component', state: 'open' },
  ] as const

  return (
    <div aria-hidden className={cn('flex w-full flex-col gap-2', className)}>
      {rows.map((row, i) => (
        <div
          key={row.text}
          // Stagger under motion-safe only — the delay classes ride with the
          // animation, so reduced motion gets the rows instantly, not blank
          // frames waiting out a delay.
          className={cn(
            'flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left text-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:fill-mode-backwards',
            i === 1 && 'motion-safe:[animation-delay:120ms]',
            i === 2 && 'motion-safe:[animation-delay:240ms]',
            row.state === 'done' && 'bg-muted',
            row.state === 'copied' && 'bg-primary/6',
            row.state === 'open' && 'bg-card',
          )}
        >
          <span
            className={cn(
              'flex size-4 shrink-0 items-center justify-center rounded-[5px] border',
              row.state === 'done'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-card',
            )}
          >
            {row.state === 'done' && (
              <HugeiconsIcon icon={Tick02Icon} className="size-3" strokeWidth={3} />
            )}
          </span>
          <span
            className={cn(
              'min-w-0 flex-1 truncate',
              row.state === 'done' && 'text-muted-foreground line-through',
            )}
          >
            {row.text}
          </span>
          {row.state === 'copied' && (
            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
              <HugeiconsIcon icon={Tick02Icon} className="size-3.5" />
              Copied
            </span>
          )}
          {row.state === 'open' && (
            <HugeiconsIcon
              icon={Copy01Icon}
              className="size-4 shrink-0 text-muted-foreground/60"
            />
          )}
        </div>
      ))}
    </div>
  )
}
