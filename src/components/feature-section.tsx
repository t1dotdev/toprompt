import type React from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Copy01Icon,
  Folder01Icon,
  ServerStack01Icon,
  SmartPhone01Icon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

type FeatureType = {
  title: string
  icon: React.ReactNode
  description: string
}

export function FeatureSection() {
  return (
    <div
      className="mx-auto grid max-w-5xl grid-cols-2 gap-4 px-4 py-4 md:grid-cols-4"
      id="features"
    >
      {features.map((feature, index) => (
        <div
          className={cn(
            'relative flex flex-col items-center justify-center p-2',
            'after:absolute after:inset-y-0 after:right-0 after:h-full after:w-px after:bg-linear-to-b after:from-foreground/6 after:via-foreground/25 after:to-foreground/6',
            '[&_svg]:size-6 [&_svg]:text-muted-foreground',
            {
              'after:hidden': index === features.length - 1,
              'after:hidden after:md:block': index === 1,
            },
          )}
          key={feature.title}
        >
          {feature.icon}
          <h3 className="mt-4 text-center font-medium text-xs md:text-sm lg:text-base">
            {feature.title}
          </h3>
          <p className="mt-1 text-center text-[10px] text-muted-foreground md:text-xs">
            {feature.description}
          </p>
        </div>
      ))}
    </div>
  )
}

const features: FeatureType[] = [
  {
    title: 'Capture anywhere',
    icon: <HugeiconsIcon icon={SmartPhone01Icon} strokeWidth={2} />,
    description: 'Mobile-first. A prompt takes seconds to stash.',
  },
  {
    title: 'One queue per project',
    icon: <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />,
    description: 'Every codebase gets its own list. Nothing else.',
  },
  {
    title: 'One-tap copy',
    icon: <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />,
    description: 'Tap a prompt, paste it into Claude Code or Cursor.',
  },
  {
    title: 'Your server',
    icon: <HugeiconsIcon icon={ServerStack01Icon} strokeWidth={2} />,
    description: 'Self-hosted, Google sign-in, no other setup.',
  },
]
