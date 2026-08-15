import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSessionFn } from '@/lib/fns'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session) throw redirect({ to: '/login' })
    return { user: session.user }
  },
})
