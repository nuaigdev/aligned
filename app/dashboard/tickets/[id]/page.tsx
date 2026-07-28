import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { formatTicketRef, ticketClientCode } from '@/lib/utils'
import TicketDetail from './TicketDetail'
import TicketComments from './TicketComments'
import TicketAttachments from './TicketAttachments'
import TicketPropertiesPanel from './TicketPropertiesPanel'
import RefreshOnMount from './RefreshOnMount'

export const dynamic = 'force-dynamic'

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()

  const { data: ticket } = await supabase
    .from('tickets')
    .select('*, clients(id, name, slug, manager_id), projects(id, name)')
    .eq('id', params.id)
    .maybeSingle()

  if (!ticket) notFound()

  const [{ data: assignees }, { data: rawComments }, { data: teamMembers }, { data: documents }] = await Promise.all([
    supabase.from('ticket_assignees').select('team_member_id').eq('ticket_id', ticket.id),
    supabase.from('ticket_comments').select('*').eq('ticket_id', ticket.id).order('created_at'),
    supabase.from('team_members').select('*').eq('is_active', true).order('name'),
    supabase.from('documents').select('*').eq('ticket_id', ticket.id).order('created_at', { ascending: false }),
  ])

  const client = ticket.clients as any
  const clientCode = client?.slug ? ticketClientCode(client.slug) : undefined
  const members = teamMembers ?? []

  // Same candidate scope as migration 010's is_on_client_team(): admins, the
  // client's Manager, and that Manager's direct reports.
  const candidatePool = members.filter(
    (m: any) => m.role === 'admin' || m.id === client?.manager_id || (client?.manager_id && m.manager_id === client.manager_id)
  )

  const memberById = new Map(members.map((m: any) => [m.id, m]))
  const comments = (rawComments ?? []).map((c: any) => ({
    ...c,
    author_member: c.created_by_team_member_id ? memberById.get(c.created_by_team_member_id) : undefined,
    mention_members: (c.mentioned_team_member_ids ?? []).map((id: string) => memberById.get(id)).filter(Boolean),
  }))

  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div>
      <RefreshOnMount />
      <Link
        href="/dashboard/tickets"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-tertiary)', textDecoration: 'none', marginBottom: '10px' }}
      >
        <ArrowLeft size={12} /> Tickets
      </Link>

      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>
        {formatTicketRef(ticket.ref_number, clientCode)} · {client?.name}
        {ticket.projects && ` · ${(ticket.projects as any).name}`}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: '20px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          <TicketDetail ticket={ticket} clientCode={clientCode} />
          <TicketAttachments
            ticketId={ticket.id}
            projectId={ticket.project_id}
            initialDocuments={documents ?? []}
          />
          <TicketComments
            ticketId={ticket.id}
            initialComments={comments}
            candidateMentions={candidatePool}
            currentTeamMemberId={user?.id ?? ''}
          />
        </div>

        <div style={{ position: 'sticky', top: '20px' }}>
          <TicketPropertiesPanel
            ticket={ticket}
            candidatePool={candidatePool}
            initialAssigneeIds={(assignees ?? []).map(a => a.team_member_id)}
          />
        </div>
      </div>
    </div>
  )
}
