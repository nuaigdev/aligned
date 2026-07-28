import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const supabase = createSupabaseServerClient()

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, slug, created_at, projects(id)')
    .order('name')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Clients</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{clients?.length ?? 0} total</p>
        </div>
        <Link
          href="/dashboard/clients/new"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '7px 14px',
            background: '#EA580C',
            color: '#fff',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          + New client
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {clients?.map(client => {
          const projectCount = (client.projects as any[])?.length ?? 0
          return (
            <Link
              key={client.id}
              href={`/dashboard/clients/${client.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '12px 16px',
                background: 'var(--bg-primary)',
                border: '0.5px solid var(--border-default)',
                borderRadius: '10px',
                textDecoration: 'none',
              }}
            >
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--brand-50)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--brand-800)',
                flexShrink: 0,
              }}>
                {client.name.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{client.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                  Added {formatDate(client.created_at)}
                </div>
              </div>
              <div style={{
                fontSize: '11px',
                padding: '2px 9px',
                borderRadius: '10px',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-tertiary)',
                fontWeight: 500,
                flexShrink: 0,
              }}>
                {projectCount} project{projectCount !== 1 ? 's' : ''}
              </div>
            </Link>
          )
        })}

        {(!clients || clients.length === 0) && (
          <div style={{
            padding: '48px 32px',
            textAlign: 'center',
            background: 'var(--bg-primary)',
            border: '0.5px solid var(--border-default)',
            borderRadius: '10px',
          }}>
            <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>No clients yet</div>
            <Link href="/dashboard/clients/new" style={{ fontSize: '13px', color: '#EA580C', textDecoration: 'none' }}>
              Add your first client →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
