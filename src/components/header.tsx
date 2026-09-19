import { Link } from '@tanstack/react-router'
import { Logo } from '@/components/logo'
import { MobileNav } from '@/components/mobile-nav'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { useScroll } from '@/hooks/use-scroll'
import { cn } from '@/lib/utils'

export const GITHUB_URL = 'https://github.com/t1dotdev/toprompt'

export const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Source', href: GITHUB_URL },
]

export function Header() {
  const scrolled = useScroll(10)

  return (
    <header
      className={cn('sticky top-0 z-50 w-full border-transparent border-b', {
        'border-border bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/50':
          scrolled,
      })}
    >
      <nav className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <a className="flex items-center gap-2 rounded-md p-2" href="#top">
          <Logo size={20} className="text-primary" />
          <span className="font-bold tracking-tight">toprompt</span>
        </a>
        <div className="hidden items-center gap-2 md:flex">
          {navLinks.map((link) => (
            <Button
              key={link.label}
              size="sm"
              variant="ghost"
              render={<a href={link.href} />}
            >
              {link.label}
            </Button>
          ))}
          <ThemeToggle className="size-9 sm:size-8" />
          <Button
            size="sm"
            render={<Link to="/login" />}
          >
            Sign in
          </Button>
        </div>
        {/* On a phone the toggle sits beside the hamburger rather than inside
            it — it is a one-tap control, not a destination. */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle className="size-9" />
          <MobileNav />
        </div>
      </nav>
    </header>
  )
}
