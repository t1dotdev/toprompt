import { useEffect, useRef, useState } from 'react'

/** Distance from the viewport edge at which a held drag starts scrolling. */
const EDGE = 72

/**
 * Index of the slot whose upper half `y` is past — i.e. where an item dragged
 * to `y` should be inserted. Exported for the self-check in reorder.test.ts;
 * this is where the off-by-one lives.
 */
export function slotIndex(
  bounds: Array<{ top: number; height: number }>,
  y: number,
) {
  if (!bounds.length) return -1
  for (let i = 0; i < bounds.length; i++) {
    if (y < bounds[i].top + bounds[i].height / 2) return i
  }
  return bounds.length - 1
}

/** Pure list move. Returns null when the move is a no-op or out of range. */
export function moveItem<T>(list: Array<T>, from: number, to: number) {
  if (from < 0 || to < 0 || to >= list.length || from >= list.length) return null
  if (to === from) return null
  const next = [...list]
  next.splice(to, 0, next.splice(from, 1)[0])
  return next
}

/**
 * Drag-to-reorder for a keyed list, driven by Pointer Events.
 *
 * Hand-rolled rather than pulled from a drag-and-drop library: the native HTML5
 * drag events never fire on touch, and this app is used from a phone first.
 * Pointer Events cover mouse and finger with one code path, and the same handle
 * takes arrow keys so reordering is not mouse-only.
 *
 * Two details that are easy to get wrong, both learned the hard way:
 * moves are tracked on `window` rather than through `setPointerCapture`, because
 * once the row slides out from under the cursor the moves belong to whatever is
 * beneath it; and the listeners are attached inside the pointerdown handler
 * rather than from an effect, because an effect only runs after React commits
 * and a fast flick can land entirely inside that gap.
 *
 * While a drag is in flight the local draft is the source of truth; on release
 * the caller commits and the list falls back to server (or optimistic) data.
 */
export function useReorder<T extends { id: string }>(
  items: Array<T>,
  onCommit: (ids: Array<string>) => void,
) {
  const [draft, setDraft] = useState<Array<T> | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const pointerY = useRef(0)
  const startIds = useRef<Array<string>>([])
  const stop = useRef(() => {})

  const list = draft ?? items
  // Listeners fire between renders, so they read the order through a ref rather
  // than a copy captured when they were attached.
  const listNow = useRef(list)
  listNow.current = list

  // A drag that outlives its list would keep listening on window forever.
  useEffect(() => () => stop.current(), [])

  function slotAt(y: number) {
    const rows = listRef.current?.querySelectorAll('[data-reorder-row]')
    if (!rows?.length) return -1
    return slotIndex(
      [...rows].map((row) => row.getBoundingClientRect()),
      y,
    )
  }

  function moveTo(id: string, to: number) {
    const current = listNow.current
    const next = moveItem(
      current,
      current.findIndex((item) => item.id === id),
      to,
    )
    if (!next) return null
    // Updated here as well as through state so that two moves arriving inside
    // one frame build on each other instead of both starting from the old order.
    listNow.current = next
    setDraft(next)
    return next
  }

  function commit(next: Array<T>) {
    const ids = next.map((item) => item.id)
    // Both calls land in one batch, so the optimistic order from onCommit is in
    // place by the time the draft is dropped — no flash back to the old order.
    if (ids.join() !== startIds.current.join()) onCommit(ids)
    setDraft(null)
  }

  function begin(id: string, y: number) {
    pointerY.current = y
    startIds.current = listNow.current.map((item) => item.id)
    setDraggingId(id)
    setDraft(listNow.current)

    const onMove = (e: PointerEvent) => {
      // Stops the gesture also being read as a text selection or page pan.
      e.preventDefault()
      pointerY.current = e.clientY
      moveTo(id, slotAt(e.clientY))
    }
    const onUp = () => {
      stop.current()
      setDraggingId(null)
      commit(listNow.current)
    }
    const onCancel = () => {
      stop.current()
      setDraggingId(null)
      setDraft(null)
    }

    // Auto-scroll while the pointer rests near a viewport edge, re-testing the
    // target as rows slide past — otherwise a list taller than the screen can
    // only be reordered within the visible slice.
    let frame = requestAnimationFrame(function step() {
      const py = pointerY.current
      const overshoot =
        py < EDGE
          ? py - EDGE
          : py > innerHeight - EDGE
            ? py - (innerHeight - EDGE)
            : 0
      if (overshoot) {
        scrollBy(0, Math.trunc(overshoot / 6) || Math.sign(overshoot))
        moveTo(id, slotAt(py))
      }
      frame = requestAnimationFrame(step)
    })

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)

    stop.current = () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      stop.current = () => {}
    }
  }

  function handleProps(id: string) {
    return {
      'data-dragging': draggingId === id ? '' : undefined,
      onPointerDown(e: React.PointerEvent<HTMLElement>) {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        begin(id, e.clientY)
      },
      onKeyDown(e: React.KeyboardEvent<HTMLElement>) {
        const delta = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
        if (!delta) return
        e.preventDefault()
        const from = listNow.current.findIndex((item) => item.id === id)
        startIds.current = listNow.current.map((item) => item.id)
        const next = moveTo(id, from + delta)
        if (next) commit(next)
      },
    }
  }

  return { list, listRef, draggingId, handleProps }
}
