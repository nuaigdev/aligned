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

  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: assignees }, { data: rawComments }, { data: teamMembers }, { data: documents }, { data: clientProjects }, { data: projectMemberRows }, canActResult] = await Promise.all([
    supabase.from('ticket_assignees').select('team_member_id').eq('ticket_id', ticket.id),
    supabase.from('ticket_comments').select('*').eq('ticket_id', ticket.id).order('created_at'),
    supabase.from('team_members').select('*').eq('is_active', true).order('name'),
    supabase.from('documents').select('*').eq('ticket_id', ticket.id).order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name').eq('client_id', ticket.client_id).order('name'),
    ticket.project_id
      ? supabase.from('project_members').select('team_member_id').eq('project_id', ticket.project_id)
      : Promise.resolve({ data: [] as { team_member_id: string }[] }),
    user
      ? supabase.rpc('can_edit_ticket', { p_ticket_id: ticket.id, p_user_id: user.id })
      : Promise.resolve({ data: false }),
  ])

  // Whether the viewer can comment/change properties/assign/attach — anyone
  // can view any ticket (migration 038), acting on one is scoped to the
  // ticket's project team (or admin/the client's Manager/creator/assignee).
  const canAct = canActResult.data === true

  const client = ticket.clients as any
  const clientCode = client?.slug ? ticketClientCode(client.slug) : undefined
  const members = teamMembers ?? []

  // Candidate pool for @mentions/assignees: the ticket's project team (+
  // admins, always eligible) when it has a project; otherwise fall back to
  // the old client-Manager-hierarchy pool — mirrors can_be_ticket_assignee.
  const projectMemberIds = new Set((projectMemberRows ?? []).map(r => r.team_member_id))
  const candidatePool = ticket.project_id
    ? members.filter((m: any) => m.role === 'admin' || projectMemberIds.has(m.id))
    : members.filter(
        (m: any) => m.role === 'admin' || m.id === client?.manager_id || (client?.manager_id && m.manager_id === client.manager_id)
      )

  const memberById = new Map(members.map((m: any) => [m.id, m]))
  const comments = (rawComments ?? []).map((c: any) => ({
    ...c,
    author_member: c.created_by_team_member_id ? memberById.get(c.created_by_team_member_id) : undefined,
    mention_members: (c.mentioned_team_member_ids ?? []).map((id: string) => memberById.get(id)).filter(Boolean),
  }))

  // Signed URLs computed up front (not just on click) so image attachments
  // can render as inline thumbnails.
  const documentsWithUrls = await Promise.all(
    (documents ?? []).map(async (doc: any) => {
      let signedUrl: string | null = null
      try {
        const { data } = await supabase.storage.from('project-documents').createSignedUrl(doc.storage_path, 3600)
        signedUrl = data?.signedUrl ?? null
      } catch {
        // Storage may not be configured; gracefully degrade
      }
      return { ...doc, signedUrl }
    })
  )

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
        {!canAct && (
          <span style={{ marginLeft: '10px', fontSize: '10px', padding: '2px 8px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', fontWeight: 500 }}>
            View only — not on this project
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 260px', gap: '20px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
          <TicketDetail ticket={ticket} clientCode={clientCode} canAct={canAct} />
          <TicketAttachments
            ticketId={ticket.id}
            projectId={ticket.project_id}
            initialDocuments={documentsWithUrls}
            canAct={canAct}
          />
          <TicketComments
            ticketId={ticket.id}
            initialComments={comments}
            candidateMentions={candidatePool}
            currentTeamMemberId={user?.id ?? ''}
            ticketType={ticket.ticket_type}
            canAct={canAct}
          />
        </div>

        <div style={{ position: 'sticky', top: '20px' }}>
          <TicketPropertiesPanel
            ticket={ticket}
            candidatePool={candidatePool}
            initialAssigneeIds={(assignees ?? []).map(a => a.team_member_id)}
            clientProjects={clientProjects ?? []}
            canAct={canAct}
          />
        </div>
      </div>
    </div>
  )
}
