/** What the palette matches against: `search` is `label` lowercased once, so a
 *  keystroke costs an `includes` per row. */
export type Searchable = { label: string; search: string }

export const terms = (query: string) =>
  query.toLowerCase().split(/\s+/).filter(Boolean)

// Every word, anywhere, in any order: "auth fix" finds "fix the auth redirect".
// A plain `includes` rather than the kit's collator match, which walks the text
// one comparison per character — fine for an app name, not for 10k of prompt.
//
// `unknown` because the kit's Command wrapper erases the item type on the way
// to the generic underneath it; every item this ever sees is a Searchable.
export const matches = (item: unknown, query: string) =>
  terms(query).every((term) => (item as Searchable).search.includes(term))

/**
 * The stretch of the prompt that matched, not its opening line — a hit two
 * thousand characters in is otherwise a result that does not contain what was
 * typed.
 */
export function excerpt(item: Searchable, query: string) {
  const at = item.search.indexOf(terms(query)[0] ?? '')
  const start = Math.max(0, at - 24)
  return (start > 0 ? '…' : '') + item.label.slice(start, start + 160)
}
