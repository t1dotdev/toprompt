import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight01Icon,
  Copy01Icon,
  SmartPhone01Icon,
  SourceCodeIcon,
} from '@hugeicons/core-free-icons'
import { GITHUB_URL } from '@/lib/site'
import { GithubIcon } from '@/components/icons/github-icon'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

/**
 * The whole nav, at every width. Two links do not earn a row of their own on a
 * desktop bar, and a menu that only exists below `md` is a second layout to
 * keep in step with the first.
 */
export function HeaderMenu() {
  const [open, setOpen] = useState(false)

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        render={
          <Button
            aria-expanded={open}
            aria-label="Toggle menu"
            className="gap-1.5 rounded-full px-3"
            size="lg"
            style={{ cornerShape: 'squircle' } as React.CSSProperties}
          />
        }
      >
        {/* Fixed width so the pill does not resize between the two words. */}
        <span className="w-10 text-start">{open ? 'Close' : 'Menu'}</span>
        {/* Two dots that swing into a cross — cheaper than a second icon and
            it animates between the states instead of swapping them. */}
        <div className="relative size-4 translate-y-px">
          <span
            className={cn(
              'absolute size-1 rounded-full bg-primary-foreground transition-all duration-200',
              open ? 'top-1.5 -left-px h-0.5 w-4 -rotate-45' : 'top-0.5 left-1.5',
            )}
          />
          <span
            className={cn(
              'absolute size-1 rounded-full bg-primary-foreground transition-all duration-200',
              open ? 'top-1.5 -left-px h-0.5 w-4 rotate-45' : 'top-2 left-1.5',
            )}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="-mr-2 w-[92svw] gap-0 overflow-hidden p-0 md:w-56"
        sideOffset={12}
      >
        <ul className="grid grid-cols-1 border-b bg-background p-2">
          {linkItems.map((item) => (
            <li className="w-full" key={item.label}>
              <a
                className="group flex w-full items-center justify-between rounded-2xl px-3 py-2 font-medium hover:bg-muted active:bg-muted dark:hover:bg-muted/50"
                href={item.href}
                onClick={() => setOpen(false)}
              >
                <div className="flex items-center gap-2">
                  <div className="[&>svg]:size-4 [&>svg]:text-primary/80">
                    {item.icon}
                  </div>
                  <p className="md:text-sm">{item.label}</p>
                </div>
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  strokeWidth={2}
                  className="size-4 opacity-50 transition-all group-hover:translate-x-0 group-hover:opacity-50 md:-translate-x-2 md:opacity-0"
                />
              </a>
            </li>
          ))}
        </ul>
        <div className="flex justify-center p-2">
          <Button
            size="icon-sm"
            variant="outline"
            className="[&>svg]:text-primary/80"
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
      </PopoverContent>
    </Popover>
  )
}

const linkItems = [
  {
    label: 'Features',
    href: '#features',
    icon: <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />,
  },
  {
    label: 'Self-host it',
    href: `${GITHUB_URL}#quickstart`,
    icon: <HugeiconsIcon icon={SmartPhone01Icon} strokeWidth={2} />,
  },
  {
    label: 'Read the source',
    href: GITHUB_URL,
    icon: <HugeiconsIcon icon={SourceCodeIcon} strokeWidth={2} />,
  },
]
