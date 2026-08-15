import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Add01Icon,
  Delete02Icon,
  Logout01Icon,
} from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth-client'
import { createProjectFn, deleteProjectFn, listProjectsFn } from '@/lib/fns'

export const Route = createFileRoute('/_authed/')({
  loader: () => listProjectsFn(),
  component: Projects,
})

function Projects() {
  const projects = Route.useLoaderData()
  const router = useRouter()
  const [name, setName] = useState('')

  return (
    <main className="mx-auto max-w-md p-4">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">toprompt</h1>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Sign out"
          onClick={async () => {
            await authClient.signOut()
            router.navigate({ to: '/login' })
          }}
        >
          <HugeiconsIcon icon={Logout01Icon} />
        </Button>
      </header>

      <form
        className="mb-6 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          const trimmed = name.trim()
          if (!trimmed) return
          await createProjectFn({ data: { name: trimmed } })
          setName('')
          router.invalidate()
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New project"
        />
        <Button type="submit" size="icon" aria-label="Add project">
          <HugeiconsIcon icon={Add01Icon} />
        </Button>
      </form>

      {projects.length === 0 && (
        <p className="text-center text-muted-foreground">
          No projects yet. Create one above.
        </p>
      )}
      <ul className="space-y-2">
        {projects.map((p) => (
          <li key={p.id} className="flex items-center rounded-xl border">
            <Link
              to="/p/$projectId"
              params={{ projectId: p.id }}
              className="min-h-12 flex-1 content-center px-4 py-3 font-medium"
            >
              {p.name}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="mr-1"
              aria-label={`Delete ${p.name}`}
              onClick={async () => {
                if (!confirm(`Delete "${p.name}" and all its prompts?`)) return
                await deleteProjectFn({ data: { id: p.id } })
                router.invalidate()
              }}
            >
              <HugeiconsIcon icon={Delete02Icon} />
            </Button>
          </li>
        ))}
      </ul>
    </main>
  )
}
