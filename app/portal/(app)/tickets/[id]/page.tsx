import { notFound } from 'next/navigation'
import { requireClientSession, getSessionClient } from '@/lib/portal/session-guard'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { formatDate, formatTicketRef, TICKET_STATUS_CONFIG, TICKET_PRIORITY_COLOR } from '@/lib/utils'
import { TICKET_PRIORITY_LABELS, type TicketPriority } from '@/types'
import PortalTicketComments from './PortalTicketComments'

export default async function PortalTicketDetailPage({ params }: { params: { id: string } }) {
  const session = await requireClientSession()
  const client = await getSessionClient()
  const supabase = createServiceRoleClient()

  const { data: ticket } = await supabase
    .from('tickets')
    .select('*, projects(name)')
    .eq('id', params.id)
    .maybeSingle()

  if (!ticket || ticket.client_id !== session.clientId) notFound()

  const [{ data: comments }, { data: contacts }] = await Promise.all([
    supabase.from('ticket_comments').select('*').eq('ticket_id', ticket.id).order('created_at'),
    supabase.from('client_contacts').select('id, name').eq('client_id', client.id).eq('is_active', true).is('project_id', null).order('name'),
  ])

  const authorIds = (comments ?? []).map(c => c.created_by_team_member_id).filter(Boolean) as string[]
  const { data: authors } = authorIds.length > 0
    ? await supabase.from('team_members').select('id, name').in('id', authorIds)
    : { data: [] }
  const authorNameById = new Map((authors ?? []).map(a => [a.id, a.name]))

  const enrichedComments = (comments ?? []).map(c => ({
    ...c,
    author_name: c.created_by_team_member_id ? authorNameById.get(c.created_by_team_member_id) : null,
  }))

  const cfg = TICKET_STATUS_CONFIG[ticket.status] ?? TICKET_STATUS_CONFIG.open

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
              {formatTicketRef(ticket.ref_number)}{ticket.projects && ` · ${(ticket.projects as any).name}`}
            </div>
            <h1 style={{ fontSize: '19px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{ticket.title}</h1>
          </div>
          <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '10px', background: cfg.bg, color: cfg.color, fontWeight: 500, flexShrink: 0 }}>{cfg.label}</span>
        </div>

        {ticket.description && (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: '10px' }}>{ticket.description}</p>
        )}

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: TICKET_PRIORITY_COLOR[ticket.priority as TicketPriority] }} />
            {TICKET_PRIORITY_LABELS[ticket.priority as TicketPriority]} priority
          </span>
          <span>·</span>
          <span>Raised {formatDate(ticket.created_at)}</span>
          {ticket.due_date && <><span>·</span><span>Due {formatDate(ticket.due_date)}</span></>}
          {ticket.blocked_on && <><span>·</span><span style={{ color: 'var(--warning-text)' }}>Waiting on {ticket.blocked_on}</span></>}
        </div>
      </div>

      <PortalTicketComments ticketId={ticket.id} initialComments={enrichedComments} contacts={contacts ?? []} />
    </div>
  )
}
