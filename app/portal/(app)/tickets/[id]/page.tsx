import { notFound } from 'next/navigation'
import { requireClientSession, getSessionClient } from '@/lib/portal/session-guard'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { formatDate, formatTicketRef, ticketClientCode, TICKET_STATUS_CONFIG, TICKET_PRIORITY_COLOR } from '@/lib/utils'
import { TICKET_PRIORITY_LABELS, type TicketPriority } from '@/types'
import PortalTicketComments from './PortalTicketComments'
import PortalTicketAttachments from './PortalTicketAttachments'

export const dynamic = 'force-dynamic'

const STATUS_EXPLANATION: Record<string, string> = {
  open: "We've received this and it's in the queue.",
  in_progress: 'Someone on the team is actively working on this.',
  resolved: "This has been resolved. If it's not actually fixed, just reply below and we'll reopen it.",
  closed: 'This ticket is closed.',
}

export default async function PortalTicketDetailPage({ params }: { params: { id: string } }) {
  const session = await requireClientSession()
  const client = await getSessionClient()
  const supabase = createServiceRoleClient()

  const { data: ticket } = await supabase
    .from('tickets')
    .select('*, projects(name)')
    .eq('id', params.id)
    .maybeSingle()

  if (!ticket || ticket.client_id !== session.clientId || ticket.ticket_type !== 'client') notFound()

  const [{ data: comments }, { data: contacts }, { data: teamMembers }, { data: documents }] = await Promise.all([
    // Only the client's own comments, or team comments explicitly marked as
    // a reply to the client — internal team notes never reach the portal.
    supabase
      .from('ticket_comments')
      .select('*')
      .eq('ticket_id', ticket.id)
      .or('created_by_client_name.not.is.null,visible_to_client.eq.true')
      .order('created_at'),
    supabase.from('client_contacts').select('id, name').eq('client_id', client.id).eq('is_active', true).is('project_id', null).order('name'),
    supabase.from('team_members').select('id, name, role, manager_id').eq('is_active', true),
    supabase.from('documents').select('*').eq('ticket_id', ticket.id).order('created_at', { ascending: false }),
  ])

  // Same "who's on this client's team" scope as is_on_client_team() — who the
  // client can @mention when they reply.
  const candidateMentions = (teamMembers ?? [])
    .filter(m => m.role === 'admin' || m.id === client.manager_id || (client.manager_id && m.manager_id === client.manager_id))
    .map(m => ({ id: m.id, name: m.name }))

  const authorIds = (comments ?? []).map(c => c.created_by_team_member_id).filter(Boolean) as string[]
  const authorNameById = new Map((teamMembers ?? []).filter(m => authorIds.includes(m.id)).map(m => [m.id, m.name]))

  const enrichedComments = (comments ?? []).map(c => ({
    ...c,
    author_name: c.created_by_team_member_id ? authorNameById.get(c.created_by_team_member_id) : null,
  }))

  const docsWithUrls = await Promise.all(
    (documents ?? []).map(async doc => {
      let signedUrl: string | null = null
      try {
        const { data } = await supabase.storage.from('project-documents').createSignedUrl(doc.storage_path, 3600)
        signedUrl = data?.signedUrl ?? null
      } catch {
        // Storage may not be configured; gracefully degrade
      }
      return {
        id: doc.id,
        name: doc.name,
        file_type: doc.file_type,
        file_size_bytes: doc.file_size_bytes,
        shared_by: doc.shared_by as 'team' | 'client',
        created_at: doc.created_at,
        signedUrl,
      }
    })
  )

  const cfg = TICKET_STATUS_CONFIG[ticket.status] ?? TICKET_STATUS_CONFIG.open

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
              {formatTicketRef(ticket.ref_number, ticketClientCode(client.slug))}{ticket.projects && ` · ${(ticket.projects as any).name}`}
            </div>
            <h1 style={{ fontSize: '19px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{ticket.title}</h1>
          </div>
          <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '10px', background: cfg.bg, color: cfg.color, fontWeight: 500, flexShrink: 0 }}>{cfg.label}</span>
        </div>

        {ticket.description && (
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: '10px' }}>{ticket.description}</p>
        )}

        <div style={{
          marginTop: '12px', padding: '9px 12px', borderRadius: '8px',
          background: 'var(--bg-tertiary)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5,
        }}>
          {STATUS_EXPLANATION[ticket.status] ?? ''}
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: TICKET_PRIORITY_COLOR[ticket.priority as TicketPriority] }} />
            {TICKET_PRIORITY_LABELS[ticket.priority as TicketPriority]} priority
          </span>
          <span>·</span>
          <span>Raised {formatDate(ticket.created_at)}</span>
          {ticket.due_date && <><span>·</span><span>Due {formatDate(ticket.due_date)}</span></>}
          {ticket.blocked_on === 'client' && <><span>·</span><span style={{ color: 'var(--warning-text)' }}>We're waiting on more info from you</span></>}
        </div>
      </div>

      <PortalTicketAttachments ticketId={ticket.id} initialDocuments={docsWithUrls} />

      <PortalTicketComments
        ticketId={ticket.id}
        initialComments={enrichedComments}
        contacts={contacts ?? []}
        candidateMentions={candidateMentions}
      />
    </div>
  )
}
