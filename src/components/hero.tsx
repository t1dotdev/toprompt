import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight02Icon, SourceCodeIcon } from '@hugeicons/core-free-icons'
import { GITHUB_URL } from '@/components/header'
import { QueuePreview } from '@/components/queue-preview'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function HeroSection() {
  return (
    <section className="mx-auto w-full max-w-5xl" id="top">
      {/* Top Shades */}
      <div
        aria-hidden="true"
        className="absolute inset-0 isolate hidden overflow-hidden contain-strict lg:block"
      >
        <div className="absolute inset-0 -top-14 isolate -z-10 bg-[radial-gradient(35%_80%_at_49%_0%,--theme(--color-foreground/.08),transparent)] contain-strict" />
      </div>

      {/* X Bold Faded Borders */}
      <div
        aria-hidden="true"
        className="absolute inset-0 mx-auto hidden min-h-screen w-full max-w-5xl lg:block"
      >
        <div className="mask-y-from-80% mask-y-to-100% absolute inset-y-0 left-0 z-10 h-full w-px bg-foreground/15" />
        <div className="mask-y-from-80% mask-y-to-100% absolute inset-y-0 right-0 z-10 h-full w-px bg-foreground/15" />
      </div>

      {/* main content */}

      <div className="relative flex flex-col items-center justify-center gap-5 px-4 pt-24 pb-20 md:pt-32">
        {/* X Content Faded Borders */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-1 size-full overflow-hidden"
        >
          <div className="absolute inset-y-0 left-4 w-px bg-linear-to-b from-transparent via-border to-border md:left-8" />
          <div className="absolute inset-y-0 right-4 w-px bg-linear-to-b from-transparent via-border to-border md:right-8" />
          <div className="absolute inset-y-0 left-8 w-px bg-linear-to-b from-transparent via-border/50 to-border/50 md:left-12" />
          <div className="absolute inset-y-0 right-8 w-px bg-linear-to-b from-transparent via-border/50 to-border/50 md:right-12" />
        </div>

        <a
          className={cn(
            'group mx-auto flex w-fit items-center gap-3 rounded-full border bg-card px-3 py-1 shadow',
            'fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards transition-all delay-500 duration-500 ease-out',
          )}
          href={GITHUB_URL}
          rel="noreferrer"
          target="_blank"
        >
          <HugeiconsIcon
            icon={SourceCodeIcon}
            strokeWidth={2}
            className="size-3 text-muted-foreground"
          />
          <span className="text-xs">Open source, MIT, self-hosted</span>
          <span className="block h-5 border-l" />

          <HugeiconsIcon
            icon={ArrowRight02Icon}
            strokeWidth={2}
            className="size-3 duration-150 ease-out group-hover:translate-x-1"
          />
        </a>

        <h1
          className={cn(
            'fade-in slide-in-from-bottom-10 animate-in text-balance fill-mode-backwards text-center font-bold text-4xl tracking-tight delay-100 duration-500 ease-out md:text-5xl lg:text-6xl',
            'text-shadow-[0_0px_50px_theme(--color-foreground/.2)]',
          )}
        >
          Stash prompts now, <br className="hidden sm:block" /> paste them later.
        </h1>

        <p className="fade-in slide-in-from-bottom-10 mx-auto max-w-md animate-in text-balance fill-mode-backwards text-center text-base text-foreground/80 delay-200 duration-500 ease-out md:text-lg">
          Prompt ideas arrive in the shower, on the train, mid-walk. Jot one from
          your phone, copy it with one tap when you're back at the keyboard.
        </p>

        <div className="fade-in slide-in-from-bottom-10 flex animate-in flex-row flex-wrap items-center justify-center gap-3 fill-mode-backwards pt-2 delay-300 duration-500 ease-out">
          <Button
            className="rounded-full"
            size="lg"
            render={<Link to="/login" />}
          >
            Start your queue
            <HugeiconsIcon
              icon={ArrowRight02Icon}
              strokeWidth={2}
              data-icon="inline-end"
            />
          </Button>
          <Button
            className="rounded-full"
            size="lg"
            variant="secondary"
            render={
              <a href={GITHUB_URL} rel="noreferrer" target="_blank" />
            }
          >
            <HugeiconsIcon
              icon={SourceCodeIcon}
              strokeWidth={2}
              data-icon="inline-start"
            />
            View the source
          </Button>
        </div>

        {/* The product itself, three rows tall — it answers "what is this?"
            faster than another paragraph would. */}
        <QueuePreview className="fade-in slide-in-from-bottom-10 mt-10 max-w-md animate-in fill-mode-backwards delay-500 duration-700 ease-out" />
      </div>
    </section>
  )
}
