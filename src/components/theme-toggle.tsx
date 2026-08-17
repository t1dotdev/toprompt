import { HugeiconsIcon } from '@hugeicons/react'
import { Moon02Icon, Sun03Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Which icon shows is decided by CSS, not by React state. The inline script in
 * the root document sets `.dark` before hydration, so a `dark:` variant already
 * has the right answer in the server-rendered markup — reading the theme into
 * state instead would mean either a hydration mismatch or a flash of the wrong
 * icon on every load.
 *
 * The icon shows where the tap goes, not where you are: a moon while the app is
 * light, a sun while it is dark.
 */
export function ThemeToggle({ className }: { className?: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('size-11 text-muted-foreground', className)}
      aria-label="Toggle light and dark theme"
      onClick={() => {
        const dark = document.documentElement.classList.toggle('dark')
        // Writing this is also what stops the app following the OS from here on
        // — the boot script only tracks `prefers-color-scheme` while unset.
        localStorage.setItem('theme', dark ? 'dark' : 'light')
      }}
    >
      {/* 20px on a phone, 16px from `md`: the glyph is the whole control here,
          and at 16px inside a 44px square it reads as a speck on a screen held
          at arm's length. */}
      <HugeiconsIcon icon={Moon02Icon} className="size-5 dark:hidden md:size-4" />
      <HugeiconsIcon
        icon={Sun03Icon}
        className="hidden size-5 dark:block md:size-4"
      />
    </Button>
  )
}
