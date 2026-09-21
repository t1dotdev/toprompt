// Run with: bun src/lib/search.test.ts
import assert from 'node:assert/strict'
import { excerpt, matches, terms } from './search'

const item = (label: string) => ({ label, search: label.toLowerCase() })

assert.deepEqual(terms('  Fix   AUTH '), ['fix', 'auth'])
assert.deepEqual(terms('   '), [])

const prompt = item('Fix the auth redirect after Google sign-in')
// Every word, any order, any case.
assert.ok(matches(prompt, 'auth fix'))
assert.ok(matches(prompt, 'GOOGLE'))
// One missing word fails the whole query.
assert.ok(!matches(prompt, 'auth stripe'))
// An empty query matches everything, which is what an open palette shows.
assert.ok(matches(prompt, ''))

// A hit near the start is shown from the start, with no ellipsis.
assert.equal(excerpt(prompt, 'fix'), prompt.label)

// A hit deep in a long prompt opens on the match, not on the first line.
const long = item(`${'x'.repeat(500)} needle ${'y'.repeat(500)}`)
const shown = excerpt(long, 'needle')
assert.ok(shown.startsWith('…'))
assert.ok(shown.includes('needle'))
assert.ok(shown.length <= 161)

// No terms at all: the opening of the text, not a slice from -1.
assert.equal(excerpt(long, ''), long.label.slice(0, 160))

console.log('search: ok')
