import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight02Icon } from '@hugeicons/core-free-icons'
import { FullWidthDivider } from '@/components/full-width-divider'
import { GITHUB_URL } from '@/components/header'
import { Button } from '@/components/ui/button'

export function CallToAction() {
  return (
    // max-w-5xl, not the block's 3xl: the border-x then lands on the same
    // column edges as the header, hero and footer instead of a fourth pair of
    // vertical rules a few hundred pixels in.
    <div className="relative mx-auto flex w-full max-w-5xl flex-col justify-between border-x">
      <FullWidthDivider className="-top-px" />
      <div className="border-b px-2 py-8">
        <h2 className="text-center font-semibold text-lg md:text-2xl">
          Your next prompt is already in your head.
        </h2>
        <p className="text-balance text-center text-muted-foreground text-sm md:text-base">
          Stash it before it's gone. Sign in with Google — that's the whole
          setup.
        </p>
      </div>
      <div className="flex items-center justify-center gap-2 bg-secondary/80 p-4 dark:bg-secondary/40">
        <Button
          variant="outline"
          render={<a href={GITHUB_URL} rel="noreferrer" target="_blank" />}
        >
          Self-host it
        </Button>
        <Button render={<Link to="/login" />}>
          Start your queue
          <HugeiconsIcon
            icon={ArrowRight02Icon}
            strokeWidth={2}
            data-icon="inline-end"
          />
        </Button>
      </div>
      <FullWidthDivider className="-bottom-px" />
    </div>
  )
}
