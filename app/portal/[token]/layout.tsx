import { createServiceRoleClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PortalTabs from './PortalTabs'

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { token: string }
}) {
  const supabase = createServiceRoleClient()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, status, clients(name, slug)')
    .eq('portal_token', params.token)
    .single()

  if (!project) notFound()

  const clientName = (project.clients as any)?.name || 'Client'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-tertiary)' }}>
      {/* Portal topbar */}
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
          <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{project.name}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Shared by NuAIg · {clientName}</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-tertiary)' }}>
          Read-only view
        </div>
      </div>

      <PortalTabs token={params.token} />

      <main style={{ padding: '24px', maxWidth: '860px', margin: '0 auto' }}>
        {children}
      </main>
    </div>
  )
}
