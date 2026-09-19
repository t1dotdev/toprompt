import { Link } from '@tanstack/react-router'
import { HeaderMenu } from '@/components/header-menu'
import { Logo } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Chrome 139+ only; everywhere else the `rounded-full` underneath is what
// shows. Nothing depends on it, so it stays an enhancement rather than a
// polyfill.
const squircle = { cornerShape: 'squircle' } as React.CSSProperties

export function Header() {
  return (
    <header
      className={cn(
        'sticky top-4 z-50 mx-auto flex h-14 w-[92svw] items-center justify-between rounded-full border bg-background/95 px-2 shadow-sm backdrop-blur-sm supports-backdrop-filter:bg-background/50',
        'md:max-w-3xl',
      )}
      style={squircle}
    >
      <a
        className="flex h-10 items-center gap-2 rounded-full px-3 hover:bg-accent"
        href="#top"
        style={squircle}
      >
        <Logo size={20} className="text-primary" />
        <span className="font-bold tracking-tight">toprompt</span>
      </a>

      <div className="flex items-center gap-2">
        <ThemeToggle className="size-9 rounded-full" />
        <Button
          className="rounded-full"
          size="lg"
          style={squircle}
          variant="outline"
          render={<Link to="/login" />}
        >
          Sign in
        </Button>
        <HeaderMenu />
      </div>
    </header>
  )
}
