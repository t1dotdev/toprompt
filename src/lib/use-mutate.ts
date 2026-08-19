import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { toastManager } from '@/components/ui/toast'

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
 *
 * Deliberately no `useTransition`: on this stack an `await` inside a
 * transition's async callback resumes immediately with undefined instead of
 * waiting. A server function called in there returned before it ever issued its
 * request, so the write silently never happened and the optimistic row snapped
 * back on the next refetch. Everything here stays outside a transition, which
 * is also why the optimistic state is plain state (see useOptimisticList)
 * rather than `useOptimistic` — that hook needs a live transition to hold a
 * value.
 */
export function useMutate() {
  const router = useRouter()
  const [inFlight, setInFlight] = useState(0)

  function mutate<T>(run: () => Promise<T>, options: MutateOptions<T>) {
    // Start the request before touching any React state. Queueing the
    // optimistic update first leaves the server function resolving without ever
    // issuing its request, so the write silently never happened and the row
    // snapped back on the next refetch.
    const request = run()
    options.optimistic?.()
    setInFlight((n) => n + 1)
    void (async () => {
      try {
        options.onSuccess?.(await request)
      } catch {
        toastManager.add({ title: options.error, type: 'error' })
        options.onError?.()
      }
      // Refetch either way: on success to pick up the real row, on failure to
      // roll the optimistic state back to what the server actually has. The
      // guess is not dropped here — useOptimisticList retires it when the new
      // data actually arrives, so the row never flashes its old value in
      // between.
      await router.invalidate()
      setInFlight((n) => n - 1)
    })()
  }

  return [inFlight > 0, mutate] as const
}

/**
 * Stand-in for `useOptimistic`: same reducer shape, but it holds the pending
 * guesses itself instead of relying on a transition staying alive across an
 * await.
 *
 * A guess is remembered along with the data it was made against, and retires
 * as soon as the loader hands down something newer — whether that confirms it
 * or contradicts it. Waiting for real data rather than for the mutation to
 * finish is what keeps the row from flashing its old value in the gap between
 * the two, and it also covers the first refetch after a page load, which does
 * not always repaint.
 */
export function useOptimisticList<S, A>(
  loaded: S,
  reduce: (state: S, action: A) => S,
) {
  const [guesses, setGuesses] = useState<Array<{ action: A; base: S }>>([])
  const live = guesses.filter((guess) => guess.base === loaded)

  function apply(action: A) {
    setGuesses((current) => [
      ...current.filter((guess) => guess.base === loaded),
      { action, base: loaded },
    ])
  }

  return [live.reduce((state, g) => reduce(state, g.action), loaded), apply] as const
}
