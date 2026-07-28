'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { markPortalSeen } from '@/lib/portal/notifications'

export default function PortalNotificationBell({ hasNewActivity }: { hasNewActivity: boolean }) {
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const showDot = hasNewActivity && !dismissed

  async function handleClick() {
    setDismissed(true)
    await markPortalSeen()
    router.push('/portal/tickets')
  }

  return (
    <button
      onClick={handleClick}
      title={showDot ? 'New activity on your tickets' : 'Tickets'}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px', display: 'flex', position: 'relative' }}
    >
      <Bell size={16} />
      {showDot && (
        <span style={{
          position: 'absolute', top: '2px', right: '2px', width: '7px', height: '7px', borderRadius: '50%',
          background: 'var(--danger-text)',
        }} />
      )}
    </button>
  )
}
