import { cn } from '@/lib/utils'

/**
 * Full-bleed sticky topbar with a column-width interior below `md`, so the app
 * reads the same on a phone and on a wide screen. Owns the top safe-area inset —
 * the bar paints under the notch instead of letting content slide beneath it.
 *
 * No trigger of its own: the sidebar collapses to an icon rail rather than
 * off-canvas, so the way back is always on screen where it went.
 */
export function AppHeader({
  className,
  children,
}: {
  /** The interior's width cap. Defaults to the home list's `max-w-md`; a page
   *  whose content runs wider passes its own, or the bar's contents sit inset
   *  from the column they title on any screen between 448px and `md`. */
  className?: string
  children?: React.ReactNode
}) {
  // 64px on a phone against 56px from `md` up: the bar holds 44px controls
  // either side of the title, and 56 leaves them 6px of air top and bottom.
  return (
    <header className="sticky top-0 z-20 border-b bg-background pt-[env(safe-area-inset-top)]">
      <div
        className={cn(
          'mx-auto flex min-h-16 max-w-md items-center gap-1 px-4 md:min-h-14 md:max-w-none md:px-6',
          className,
        )}
      >
        {children}
      </div>
    </header>
  )
}
