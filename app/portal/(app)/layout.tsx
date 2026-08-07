import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getSessionClient } from '@/lib/portal/session-guard'
import PortalLogoutButton from './LogoutButton'
import PortalNotificationBell from './PortalNotificationBell'
import { Logo } from '@/components/Logo'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const client = await getSessionClient()

  // A client login with a temporary/reset password must set a real one
  // before touching anything else — enforced here so it applies to every
  // page in this group, not just the ones that remember to check.
  if (client.mustChangePassword) {
    redirect('/portal/change-password')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-tertiary)' }}>
      <div style={{
        background: 'var(--bg-primary)',
        borderBottom: '0.5px solid var(--border-default)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
      }}>
        <Link href="/portal" style={{ display: 'flex', alignItems: 'center', gap: '14px', textDecoration: 'none' }}>
          <Logo size={22} wordmarkSize={15} />
          <div style={{ width: '1px', height: '18px', background: 'var(--border-default)' }} />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{client.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Signed in as {client.loginName}</div>
          </div>
        </Link>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link
            href="/portal/tickets/new"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '12px', fontWeight: 500, color: '#fff', background: 'var(--brand-600)',
              padding: '7px 12px', borderRadius: '7px', textDecoration: 'none',
            }}
          >
            <Plus size={13} /> New ticket
          </Link>
          <PortalNotificationBell />
          <PortalLogoutButton />
        </div>
      </div>

      <main style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        {children}
      </main>
    </div>
  )
}
