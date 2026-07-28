import Link from 'next/link'
import { getSessionClient } from '@/lib/portal/session-guard'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { formatRelative, formatTicketRef, ticketClientCode, TICKET_STATUS_CONFIG, TICKET_PRIORITY_COLOR } from '@/lib/utils'
import { Plus, Inbox } from 'lucide-react'
import { EmptyState } from '@/components/dashboard/EmptyState'

export const dynamic = 'force-dynamic'

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
  const clientCode = ticketClientCode(client.slug)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div>
        <h1 style={{ fontSize: '19px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Tickets</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
          Anything you raise here goes straight to your NuAIg team.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <Link href="/portal/tickets" style={chipStyle(!filterStatus)}>All</Link>
          {Object.entries(TICKET_STATUS_CONFIG).map(([key, cfg]) => (
            <Link key={key} href={`/portal/tickets?status=${key}`} style={chipStyle(filterStatus === key)}>
              {cfg.label}
            </Link>
          ))}
        </div>
        <Link
          href="/portal/tickets/new"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, color: '#fff', background: 'var(--brand-600)', padding: '8px 14px', borderRadius: '8px', textDecoration: 'none' }}
        >
          <Plus size={14} /> New ticket
        </Link>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={filterStatus ? 'Nothing here' : 'No tickets yet'}
          description={filterStatus ? 'Try a different filter, or clear it to see everything.' : "Raise your first ticket and we'll take it from there."}
          actionLabel={filterStatus ? undefined : 'Raise a ticket'}
          actionHref={filterStatus ? undefined : '/portal/tickets/new'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filtered.map((t, i) => {
            const cfg = TICKET_STATUS_CONFIG[t.status] ?? TICKET_STATUS_CONFIG.open
            const commentCount = (t as any).ticket_comments?.[0]?.count ?? 0
            return (
              <Link
                key={t.id}
                href={`/portal/tickets/${t.id}`}
                className="hover-card animate-in"
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 16px', background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', textDecoration: 'none', animationDelay: `${Math.min(i, 10) * 30}ms` }}
              >
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: TICKET_PRIORITY_COLOR[t.priority], flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>{formatTicketRef(t.ref_number, clientCode)}</span>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                {commentCount > 0 && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>{commentCount} repl{commentCount === 1 ? 'y' : 'ies'}</span>}
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
    color: active ? 'var(--brand-600)' : 'var(--text-secondary)',
  }
}
