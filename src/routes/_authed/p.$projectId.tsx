import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, Delete02Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  createPromptFn,
  deletePromptFn,
  getProjectFn,
  togglePromptFn,
} from '@/lib/fns'

export const Route = createFileRoute('/_authed/p/$projectId')({
  loader: ({ params }) => getProjectFn({ data: { id: params.projectId } }),
  notFoundComponent: () => (
    <p className="p-8 text-center text-muted-foreground">Project not found.</p>
  ),
  component: ProjectView,
})

async function copyPrompt(text: string) {
  if (!navigator.clipboard) {
    toast.error('Clipboard requires HTTPS')
    return
  }
  await navigator.clipboard.writeText(text)
  toast('Copied')
}

function ProjectView() {
  const { project, prompts } = Route.useLoaderData()
  const router = useRouter()
  const [text, setText] = useState('')

  return (
    <main className="mx-auto max-w-md p-4">
      <header className="mb-6 flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Back" render={<Link to="/" />}>
          <HugeiconsIcon icon={ArrowLeft01Icon} />
        </Button>
        <h1 className="truncate text-2xl font-bold">{project.name}</h1>
      </header>

      <form
        className="mb-6 space-y-2"
        onSubmit={async (e) => {
          e.preventDefault()
          const trimmed = text.trim()
          if (!trimmed) return
          await createPromptFn({
            data: { projectId: project.id, text: trimmed },
          })
          setText('')
          router.invalidate()
        }}
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a prompt…"
          rows={3}
        />
        <Button type="submit" className="w-full">
          Add prompt
        </Button>
      </form>

      {prompts.length === 0 && (
        <p className="text-center text-muted-foreground">No prompts yet.</p>
      )}
      <ul className="space-y-2">
        {prompts.map((p) => (
          <li key={p.id} className="flex items-start gap-3 rounded-xl border p-3">
            <Checkbox
              className="mt-1"
              checked={p.done}
              aria-label="Mark done"
              onCheckedChange={async (checked) => {
                await togglePromptFn({
                  data: { id: p.id, done: Boolean(checked) },
                })
                router.invalidate()
              }}
            />
            <button
              type="button"
              className={cn(
                'flex-1 text-left text-sm whitespace-pre-wrap break-words',
                p.done && 'text-muted-foreground line-through',
              )}
              onClick={() => copyPrompt(p.text)}
            >
              {p.text}
            </button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete prompt"
              onClick={async () => {
                await deletePromptFn({ data: { id: p.id } })
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
