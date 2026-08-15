/**
 * The toprompt mark: a check landing on a prompt line. Strokes use
 * `currentColor`, so it follows the text colour it sits in and needs no
 * light/dark variant — the same reason the app's other icons are stroked.
 */
export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 11 L9 16 L20 5" />
      <path d="M11.5 19 H20" />
    </svg>
  )
}
