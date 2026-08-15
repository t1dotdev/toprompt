/**
 * Full-bleed sticky bar with a column-width interior, so the app reads the same
 * on a phone and on a wide screen. Owns the top safe-area inset — the bar paints
 * under the notch instead of letting content slide beneath it.
 */
export function AppHeader({ children }: { children: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex min-h-14 max-w-md items-center gap-1 px-4">
        {children}
      </div>
    </header>
  )
}
