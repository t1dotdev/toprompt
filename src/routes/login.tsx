import { createFileRoute, redirect } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { authClient } from '@/lib/auth-client'
import { getSessionFn } from '@/lib/fns'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    if (await getSessionFn()) throw redirect({ to: '/' })
  },
  component: Login,
})

function Login() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold">toprompt</h1>
        <p className="mt-2 text-muted-foreground">
          Stash prompts now, paste them later.
        </p>
      </div>
      <Button
        size="lg"
        onClick={() =>
          authClient.signIn.social({ provider: 'google', callbackURL: '/' })
        }
      >
        Continue with Google
      </Button>
    </main>
  )
}
