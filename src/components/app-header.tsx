/**
 * Full-bleed sticky topbar with a column-width interior below `md`, so the app
 * reads the same on a phone and on a wide screen. Owns the top safe-area inset —
 * the bar paints under the notch instead of letting content slide beneath it.
 *
 * No trigger of its own: the sidebar collapses to an icon rail rather than
 * off-canvas, so the way back is always on screen where it went.
 */
export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex min-h-14 max-w-md items-center gap-1 px-4 md:max-w-none md:px-6">
        {children}
      </div>
    </header>
  )
}
