'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { logoutClient } from '@/app/login-actions'

export default function PortalLogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await logoutClient()
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      title="Sign out"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--text-tertiary)',
        padding: '4px',
        display: 'flex',
      }}
    >
      <LogOut size={14} />
    </button>
  )
}
