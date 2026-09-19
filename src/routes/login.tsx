import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { toastManager } from '@/components/ui/toast'
import { Logo } from '@/components/logo'
import { QueuePreview } from '@/components/queue-preview'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { authClient } from '@/lib/auth-client'
import { getSessionFn } from '@/lib/fns'

export const Route = createFileRoute('/login')({
  head: () => ({ meta: [{ title: 'Sign in · toprompt' }] }),
  beforeLoad: async () => {
    if (await getSessionFn()) throw redirect({ to: '/app' })
  },
  component: Login,
})

/** Google's four-colour G, per their sign-in branding. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 shrink-0">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.28V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.98 11.98 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  )
}

function Login() {
  // The OAuth redirect can take a second or two; without this the button looks
  // like it did nothing and gets tapped again.
  const [redirecting, setRedirecting] = useState(false)

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-10 px-6 py-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-col items-center text-center">
        <div className="mb-6 flex items-center gap-2">
          <Logo size={26} className="text-primary" />
          <span className="text-lg font-bold tracking-tight">toprompt</span>
        </div>
        {/* The tagline is the headline — the brand row above already says the
            name, so the biggest type on the page gets to say what it's for. */}
        <h1 className="text-balance text-3xl font-bold tracking-tight">
          Stash prompts now, paste them later.
        </h1>
        <p className="mt-3 max-w-[34ch] text-balance text-muted-foreground">
          One queue per codebase. Tap a prompt to copy it — it ticks itself off
          as you go.
        </p>
      </div>

      <QueuePreview />

      <div className="flex w-full flex-col items-center gap-3">
        <Button
          variant="outline"
          size="lg"
          className="h-12 w-full"
          disabled={redirecting}
          onClick={async () => {
            setRedirecting(true)
            try {
              await authClient.signIn.social({
                provider: 'google',
                callbackURL: '/app',
              })
            } catch {
              setRedirecting(false)
              toastManager.add({
                title: "Couldn't reach Google. Check your connection and try again.",
                type: 'error',
              })
            }
          }}
        >
          {redirecting ? <Spinner /> : <GoogleMark />}
          {redirecting ? 'Opening Google…' : 'Continue with Google'}
        </Button>
        <p className="max-w-[36ch] text-balance text-center text-xs text-muted-foreground">
          Your Google account is the whole setup — nothing else to configure.
        </p>
      </div>
    </main>
  )
}
