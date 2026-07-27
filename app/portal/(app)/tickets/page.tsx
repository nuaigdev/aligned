import Link from 'next/link'
import { getSessionClient } from '@/lib/portal/session-guard'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { formatRelative, formatTicketRef, TICKET_STATUS_CONFIG, TICKET_PRIORITY_COLOR } from '@/lib/utils'

export default async function PortalTicketsPage({ searchParams }: { searchParams: { status?: string } }) {
  const client = await getSessionClient()
  const supabase = createServiceRoleClient()

  const { data: tickets } = await supabase
    .from('tickets')
    .select('*, ticket_comments(count)')
    .eq('client_id', client.id)
    .order('updated_at', { ascending: false })

  const filterStatus = searchParams.status
  const filtered = (tickets ?? []).filter(t => !filterStatus || t.status === filterStatus)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <Link href="/portal/tickets" style={chipStyle(!filterStatus)}>All</Link>
          {Object.entries(TICKET_STATUS_CONFIG).map(([key, cfg]) => (
            <Link key={key} href={`/portal/tickets?status=${key}`} style={chipStyle(filterStatus === key)}>
              {cfg.label}
            </Link>
          ))}
        </div>
        <Link href="/portal/tickets/new" style={{ fontSize: '13px', fontWeight: 500, color: '#fff', background: '#EA580C', padding: '8px 14px', borderRadius: '8px', textDecoration: 'none' }}>
          + New ticket
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '48px 32px', textAlign: 'center', background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', fontSize: '14px', color: 'var(--text-tertiary)' }}>
          No tickets here yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filtered.map(t => {
            const cfg = TICKET_STATUS_CONFIG[t.status] ?? TICKET_STATUS_CONFIG.open
            const commentCount = (t as any).ticket_comments?.[0]?.count ?? 0
            return (
              <Link
                key={t.id}
                href={`/portal/tickets/${t.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 16px', background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', textDecoration: 'none' }}
              >
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: TICKET_PRIORITY_COLOR[t.priority], flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>{formatTicketRef(t.ref_number)}</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                {commentCount > 0 && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>{commentCount} reply{commentCount === 1 ? '' : 'ies'}</span>}
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: cfg.bg, color: cfg.color, fontWeight: 500, flexShrink: 0 }}>{cfg.label}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>{formatRelative(t.updated_at)}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: '12px', fontWeight: active ? 500 : 400, padding: '6px 12px', borderRadius: '8px', textDecoration: 'none',
    background: active ? 'var(--brand-50)' : 'var(--bg-tertiary)',
    color: active ? '#EA580C' : 'var(--text-secondary)',
  }
}
