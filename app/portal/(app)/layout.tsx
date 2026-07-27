import { getSessionClient } from '@/lib/portal/session-guard'
import PortalNav from './PortalNav'
import PortalLogoutButton from './LogoutButton'

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
        <div style={{ fontSize: '15px', fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          <span style={{ color: '#534AB7' }}>Aligned</span>
        </div>
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
