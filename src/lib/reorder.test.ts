/**
 * Self-check for the reorder maths. Run with `bun src/lib/reorder.test.ts`.
 *
 * Covers the two places a drag-to-reorder gets silently wrong: which slot a
 * pointer position maps to, and the splice that has to survive moving an item
 * both up and down past itself.
 */
import { strict as assert } from 'node:assert'
import { moveItem, slotIndex } from './use-reorder'

// Three 50px rows starting at y=100, laid out like the project list.
const rows = [
  { top: 100, height: 50 },
  { top: 160, height: 50 },
  { top: 220, height: 50 },
]

// Above everything, and past the first midpoint.
assert.equal(slotIndex(rows, 0), 0)
assert.equal(slotIndex(rows, 124), 0)
// Just past row 0's midpoint (125) belongs to row 1.
assert.equal(slotIndex(rows, 126), 1)
assert.equal(slotIndex(rows, 184), 1)
assert.equal(slotIndex(rows, 186), 2)
// Below the list clamps to the last slot rather than falling off the end.
assert.equal(slotIndex(rows, 9999), 2)
assert.equal(slotIndex([], 50), -1)

const abc = ['a', 'b', 'c']

// Dragging the first item to the bottom, and the last to the top.
assert.deepEqual(moveItem(abc, 0, 2), ['b', 'c', 'a'])
assert.deepEqual(moveItem(abc, 2, 0), ['c', 'a', 'b'])
assert.deepEqual(moveItem(abc, 1, 0), ['b', 'a', 'c'])
assert.deepEqual(moveItem(abc, 0, 1), ['b', 'a', 'c'])

// No-ops and out-of-range return null so the caller can skip the state update.
assert.equal(moveItem(abc, 1, 1), null)
assert.equal(moveItem(abc, -1, 0), null)
assert.equal(moveItem(abc, 0, 3), null)
assert.equal(moveItem(abc, 3, 0), null)

// The input is never mutated — the draft and the committed list must not alias.
assert.deepEqual(abc, ['a', 'b', 'c'])

// A full drag of the bottom row to the top, the way the hook composes them:
// the pointer lands above row 0's midpoint, so the item ends up at index 0.
const dragged = moveItem(abc, 2, slotIndex(rows, 110))
assert.deepEqual(dragged, ['c', 'a', 'b'])

console.log('reorder: all assertions passed')
