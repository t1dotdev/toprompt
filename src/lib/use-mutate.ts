import { useTransition } from 'react'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'

type MutateOptions<T> = {
  /** Shown as a toast when the server function rejects. */
  error: string
  /** Applied immediately so the UI reacts on the same frame as the tap. */
  optimistic?: () => void
  /** Runs after a failure — use it to put a discarded draft back in the form. */
  onError?: () => void
  /** Runs with whatever the server function resolved to, before the refetch. */
  onSuccess?: (result: T) => void
}

/**
 * Every mutation goes through here. Server functions are fire-and-forget
 * promises, so without this each call site silently swallowed its own failures
 * and gave no sign that anything was in flight.
 */
export function useMutate() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function mutate<T>(run: () => Promise<T>, options: MutateOptions<T>) {
    startTransition(async () => {
      options.optimistic?.()
      try {
        options.onSuccess?.(await run())
      } catch {
        toast.error(options.error)
        options.onError?.()
      }
      // Refetch either way: on success to pick up the real row, on failure to
      // roll the optimistic state back to what the server actually has.
      await router.invalidate()
    })
  }

  return [pending, mutate] as const
}
