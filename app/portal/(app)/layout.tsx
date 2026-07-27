import { getSessionClient } from '@/lib/portal/session-guard'
import PortalNav from './PortalNav'
import PortalLogoutButton from './LogoutButton'
import { Logo } from '@/components/Logo'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const client = await getSessionClient()

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
        <Logo size={22} wordmarkSize={15} />
        <div style={{ width: '1px', height: '18px', background: 'var(--border-default)' }} />
        <div>
          <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{client.name}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Client portal</div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <PortalLogoutButton />
        </div>
      </div>

      <PortalNav />

      <main style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        {children}
      </main>
    </div>
  )
}
