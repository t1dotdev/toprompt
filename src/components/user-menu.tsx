import { useRouter } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Logout01Icon, UnfoldMoreIcon } from '@hugeicons/core-free-icons'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenuButton } from '@/components/ui/sidebar'
import { authClient } from '@/lib/auth-client'

/** "Ada Lovelace" → "AL", "Ada" → "A". Falls back to a glyph, never to blank. */
function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

/**
 * Two shapes, one menu. `avatar` is a 32px circle inside a 44px hit area — the
 * same tap target as every other control in the top bar, without an oversized
 * face next to the title. `full` is the sidebar footer button: the account is
 * already identified there, so the row spells out who is signed in.
 */
export function UserMenu({
  user,
  variant = 'avatar',
}: {
  user: { name: string; email: string; image?: string | null }
  variant?: 'avatar' | 'full'
}) {
  const router = useRouter()
  const full = variant === 'full'

  const face = (
    <Avatar>
      {user.image && (
        // Google serves avatars 403 to requests carrying a referrer.
        <AvatarImage src={user.image} alt="" referrerPolicy="no-referrer" />
      )}
      <AvatarFallback>{initials(user.name)}</AvatarFallback>
    </Avatar>
  )

  return (
    <DropdownMenu>
      {full ? (
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton
              size="lg"
              className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
            />
          }
        >
          {face}
          <span className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate text-sm font-medium">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </span>
          <HugeiconsIcon icon={UnfoldMoreIcon} className="ml-auto" />
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger
          aria-label="Account"
          className="-mr-1.5 flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {face}
        </DropdownMenuTrigger>
      )}

      {/* Opens upward out of the footer; the top bar has room below it. */}
      <DropdownMenuContent
        align={full ? 'start' : 'end'}
        side={full ? 'top' : 'bottom'}
        className="min-w-56"
      >
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
            // The offline cache holds server-rendered pages, which means it
            // holds this account's project names. Leaving them on the device
            // after the session has gone is the one thing that cache must not
            // do. Fire-and-forget: the worker answers on its own thread and
            // signing out should not wait on it.
            navigator.serviceWorker?.controller?.postMessage('clear-cache')
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
