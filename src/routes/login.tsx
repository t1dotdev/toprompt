import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { authClient } from '@/lib/auth-client'
import { getSessionFn } from '@/lib/fns'

export const Route = createFileRoute('/login')({
  head: () => ({ meta: [{ title: 'Sign in · toprompt' }] }),
  beforeLoad: async () => {
    if (await getSessionFn()) throw redirect({ to: '/' })
  },
  component: Login,
})

function Login() {
  // The OAuth redirect can take a second or two; without this the button looks
  // like it did nothing and gets tapped again.
  const [redirecting, setRedirecting] = useState(false)

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-6 py-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="text-center">
        <Logo size={40} className="mx-auto mb-4 block" />
        <h1 className="text-3xl font-bold tracking-tight">toprompt</h1>
        <p className="mt-2 text-balance text-muted-foreground">
          Stash prompts now, paste them later.
        </p>
      </div>

      <Button
        size="lg"
        className="h-12 w-full max-w-xs"
        disabled={redirecting}
        onClick={async () => {
          setRedirecting(true)
          try {
            await authClient.signIn.social({
              provider: 'google',
              callbackURL: '/',
            })
          } catch {
            setRedirecting(false)
            toast.error("Couldn't reach Google. Check your connection and try again.")
          }
        }}
      >
        {redirecting && <Spinner />}
        {redirecting ? 'Opening Google…' : 'Continue with Google'}
      </Button>
    </main>
  )
}
