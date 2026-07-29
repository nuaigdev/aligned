import Link from 'next/link'
import { getSessionProject, getSessionClient } from '@/lib/portal/session-guard'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { formatRelative, formatTicketRef, ticketClientCode, TICKET_STATUS_CONFIG, TICKET_PRIORITY_COLOR } from '@/lib/utils'
import { Inbox } from 'lucide-react'
import { EmptyState } from '@/components/dashboard/EmptyState'

export const dynamic = 'force-dynamic'

export default async function PortalProjectTicketsPage({ params }: { params: { projectId: string } }) {
  const project = await getSessionProject(params.projectId)
  const client = await getSessionClient()
  const supabase = createServiceRoleClient()

  const { data: tickets } = await supabase
    .from('tickets')
    .select('*, ticket_comments(count)')
    .eq('project_id', project.id)
    .eq('ticket_type', 'client')
    .order('updated_at', { ascending: false })

  const clientCode = ticketClientCode(client.slug)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {(tickets ?? []).length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No tickets for this project yet"
          description="Raise one with New ticket up top and pick this project."
        />
      ) : (
        (tickets ?? []).map((t, i) => {
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
        })
      )}
    </div>
  )
}
