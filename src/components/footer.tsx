import { Link } from '@tanstack/react-router'
import { GITHUB_URL } from '@/components/header'
import { GithubIcon } from '@/components/icons/github-icon'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: GITHUB_URL, label: 'Source' },
  { href: `${GITHUB_URL}#quickstart`, label: 'Self-host' },
  { href: `${GITHUB_URL}/blob/main/LICENSE`, label: 'MIT licence' },
]

export function Footer() {
  return (
    // w-full because the landing shell is a flex column: `mx-auto` alone
    // overrides the default `stretch` and shrinks the footer to its content.
    <footer className="mx-auto w-full max-w-5xl *:px-4 *:md:px-6">
      <div className="flex flex-col gap-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={20} className="text-primary" />
            <span className="font-bold tracking-tight">toprompt</span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            render={
              <a
                aria-label="GitHub"
                href={GITHUB_URL}
                rel="noreferrer"
                target="_blank"
              />
            }
          >
            <GithubIcon />
          </Button>
        </div>

        <nav>
          <ul className="flex flex-wrap gap-4 font-medium text-muted-foreground text-sm md:gap-6">
            {navLinks.map((link) => (
              <li key={link.label}>
                <a className="hover:text-foreground" href={link.href}>
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <Link className="hover:text-foreground" to="/login">
                Sign in
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="flex items-center justify-between gap-4 border-t py-4 text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} toprompt</p>
        <p>idea → stash → copy → done</p>
      </div>
    </footer>
  )
}
