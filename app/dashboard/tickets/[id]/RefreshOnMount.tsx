'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Next.js 14.1's client-side router cache can still serve a stale RSC
 * payload for this route for ~30s after a prior visit (the `staleTimes`
 * config to disable that isn't available until 14.2) — so navigating back
 * to a ticket right after a comment landed elsewhere could show it as
 * missing until a manual refresh. Forces one on every mount instead.
 * Renders nothing; new comments after mount still arrive live via the
 * Realtime subscription in TicketComments.tsx.
 */
export default function RefreshOnMount() {
  const router = useRouter()
  useEffect(() => {
    router.refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}
