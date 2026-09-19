import { createFileRoute, redirect } from '@tanstack/react-router'
import { CallToAction } from '@/components/cta'
import { FeatureSection } from '@/components/feature-section'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { HeroSection } from '@/components/hero'
import { getSessionFn } from '@/lib/fns'

export const Route = createFileRoute('/')({
  // The front door is for people who don't have a queue yet. Anyone signed in
  // typed this URL to get to their prompts, not to read the pitch again.
  beforeLoad: async () => {
    if (await getSessionFn()) throw redirect({ to: '/app' })
  },
  component: Landing,
})

function Landing() {
  return (
    // clip, not hidden: `overflow-x: hidden` computes `overflow-y` to `auto`,
    // which makes this div the header's scroll container — and since the
    // document is what actually scrolls, the sticky header never engages.
    // `clip` trims the full-bleed dividers without creating a scroll port.
    <div className="relative flex min-h-dvh flex-col overflow-x-clip">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <FeatureSection />
        {/* Asymmetric on purpose: the footer brings its own 24px of top
            padding, so a matching pb-20 here would read as a dead band. */}
        <div className="pt-20 pb-10">
          <CallToAction />
        </div>
      </main>
      <Footer />
    </div>
  )
}
