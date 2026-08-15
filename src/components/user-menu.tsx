import { useRouter } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Logout01Icon } from '@hugeicons/core-free-icons'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authClient } from '@/lib/auth-client'

/** "Ada Lovelace" → "AL", "Ada" → "A". Falls back to a glyph, never to blank. */
function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

/**
 * The avatar is a 32px circle inside a 44px hit area — the same tap target as
 * every other control in the bar, without an oversized face next to the title.
 */
export function UserMenu({
  user,
}: {
  user: { name: string; email: string; image?: string | null }
}) {
  const router = useRouter()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account"
        className="-mr-1.5 flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar>
          {user.image && (
            // Google serves avatars 403 to requests carrying a referrer.
            <AvatarImage src={user.image} alt="" referrerPolicy="no-referrer" />
          )}
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-56">
        {/*
          Not DropdownMenuLabel: that renders Base UI's GroupLabel, which throws
          outside a Menu.Group. This is a header saying who is signed in, not a
          label for a group of items, so there is no group to put it in.
        */}
        <div className="flex flex-col gap-0.5 px-3 py-2.5 text-xs text-muted-foreground">
          <span className="truncate text-sm text-foreground">{user.name}</span>
          <span className="truncate">{user.email}</span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await authClient.signOut()
            router.navigate({ to: '/login' })
          }}
        >
          <HugeiconsIcon icon={Logout01Icon} />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
