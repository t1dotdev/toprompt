import { useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'

/**
 * Rename in place — the sidebar row and the project topbar both swap their name
 * for this, so the field takes over the footprint of whatever it renames rather
 * than opening a dialog over it. The caller sizes it to that footprint.
 *
 * Uncontrolled: the value only has to survive until it commits, and reading it
 * on the way out means Escape can drop the edit by unmounting — no blur fires
 * for a removed node, so there is no stale draft to undo.
 */
export function RenameField({
  ref,
  name,
  onRename,
  onClose,
  className,
}: {
  /** The caller's, not ours: the menu that opened this field hands focus back
   *  on close, and it needs the input to hand it to. */
  ref: React.RefObject<HTMLInputElement | null>
  name: string
  onRename: (name: string) => void
  onClose: () => void
  className?: string
}) {
  // Escape cannot rely on the unmount beating the blur. Inside a popup, Base UI
  // answers Escape by pulling focus back to the trigger, and that blur lands
  // while the field is still mounted — so the cancel committed the very draft
  // it was meant to throw away.
  const cancelled = useRef(false)

  // On `window`, capturing: the capture phase runs window → document → the
  // popup → here, so this is the one place the flag is guaranteed to be set
  // before anything else in the page can react to the key and blur the field.
  // The input's own handler is too late — it is the target, and it never even
  // runs once focus has already moved.
  useEffect(() => {
    const flag = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelled.current = true
    }
    window.addEventListener('keydown', flag, true)
    return () => window.removeEventListener('keydown', flag, true)
  }, [])

  function commit() {
    if (cancelled.current) return
    const next = ref.current?.value.trim()
    onClose()
    // An emptied field reads as "never mind", not as a request for a nameless
    // project — same for typing the name it already had.
    if (next && next !== name) onRename(next)
  }

  return (
    <form
      className="min-w-0 flex-1"
      onSubmit={(e) => {
        e.preventDefault()
        commit()
      }}
    >
      <Input
        ref={ref}
        defaultValue={name}
        aria-label={`Rename ${name}`}
        maxLength={200}
        autoComplete="off"
        enterKeyHint="done"
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        // Escape drops the edit: nothing is written and the caller repaints
        // from the name it still has. stopPropagation keeps that first Escape
        // to itself — in a popup it would otherwise close the whole thing on
        // the way past.
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return
          e.stopPropagation()
          cancelled.current = true
          onClose()
        }}
        className={className}
      />
    </form>
  )
}
