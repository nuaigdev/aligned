import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatTicketRef } from '@/lib/utils'
import TicketDetail from './TicketDetail'
import TicketComments from './TicketComments'

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()

  const { data: ticket } = await supabase
    .from('tickets')
    .select('*, clients(id, name, manager_id), projects(id, name)')
    .eq('id', params.id)
    .maybeSingle()

  if (!ticket) notFound()

  const [{ data: assignees }, { data: rawComments }, { data: teamMembers }] = await Promise.all([
    supabase.from('ticket_assignees').select('team_member_id').eq('ticket_id', ticket.id),
    supabase.from('ticket_comments').select('*').eq('ticket_id', ticket.id).order('created_at'),
    supabase.from('team_members').select('*').eq('is_active', true).order('name'),
  ])

  const client = ticket.clients as any
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
      <div style={{ marginBottom: '16px', fontSize: '12px' }}>
        <Link href="/dashboard/tickets" style={{ color: '#534AB7', textDecoration: 'none' }}>Tickets</Link>
        <span style={{ color: 'var(--text-tertiary)' }}> / {formatTicketRef(ticket.ref_number)} · {client?.name}</span>
        {ticket.projects && (
          <span style={{ color: 'var(--text-tertiary)' }}> · {(ticket.projects as any).name}</span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', maxWidth: '760px' }}>
        <TicketDetail
          ticket={ticket}
          candidatePool={candidatePool}
          initialAssigneeIds={(assignees ?? []).map(a => a.team_member_id)}
        />
        <TicketComments
          ticketId={ticket.id}
          initialComments={comments}
          candidateMentions={candidatePool}
          currentTeamMemberId={user?.id ?? ''}
        />
      </div>
    </div>
  )
}
