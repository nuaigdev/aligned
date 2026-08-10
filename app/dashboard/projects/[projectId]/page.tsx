import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Ticket, Loader2, AlertTriangle, UserX } from 'lucide-react'
import DeleteConfirmButton from '@/components/dashboard/DeleteConfirmButton'
import { deleteProject } from '@/lib/projects/actions'
import { StatCard } from '@/components/dashboard/StatCard'
import TicketsBoard from '@/app/dashboard/tickets/TicketsBoard'
import type { BoardTicket } from '@/app/dashboard/tickets/TicketCard'
import type { SelectableProject } from '@/app/dashboard/tickets/TicketsBoard'
import ProjectMembersManager from './ProjectMembersManager'
import EditProjectModal from './EditProjectModal'

export const dynamic = 'force-dynamic'

export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: project } = await supabase
    .from('projects')
    .select('*, clients(id, name, slug, manager_id, last_portal_seen_at, created_at, updated_at)')
    .eq('id', params.projectId)
    .single()

  if (!project) notFound()

  const [
    { data: me },
    { data: rawTickets },
    { data: teamMembers },
    { data: memberRows },
  ] = await Promise.all([
    user ? supabase.from('team_members').select('role').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase
      .from('tickets')
      .select(`
        *,
        clients(name, slug),
        ticket_assignees(team_member_id, team_members!ticket_assignees_team_member_id_fkey(id, name, role, manager_id, email, is_active, created_at, updated_at)),
        ticket_comments(count)
      `)
      .eq('project_id', params.projectId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase.from('team_members').select('*').eq('is_active', true).order('name'),
    supabase.from('project_members').select('team_member_id').eq('project_id', params.projectId),
  ])

  const canManageProject = me?.role === 'admin' || me?.role === 'manager'
  const members = teamMembers ?? []
  const memberIds = new Set((memberRows ?? []).map(r => r.team_member_id))
  const projectMembers = members.filter(m => memberIds.has(m.id))

  const projectTickets: BoardTicket[] = (rawTickets ?? []).map((t: any) => ({
    ...t,
    client_name: t.clients?.name,
    client_slug: t.clients?.slug,
    assignee_members: (t.ticket_assignees ?? []).map((a: any) => a.team_members).filter(Boolean),
    comment_count: t.ticket_comments?.[0]?.count ?? 0,
  }))

  const openCount = projectTickets.filter(t => t.status === 'open').length
  const inProgressCount = projectTickets.filter(t => t.status === 'in_progress').length
  const activeTickets = projectTickets.filter(t => t.status === 'open' || t.status === 'in_progress')
  const urgentCount = activeTickets.filter(t => t.priority === 'urgent').length
  const unassignedCount = activeTickets.filter(t => (t.assignee_members ?? []).length === 0).length

  const client = project.clients as any

  const STATUS_LABEL: Record<string, string> = {
    active: 'Active', awaiting_client: 'Awaiting client',
    awaiting_team: 'Awaiting team', on_hold: 'On hold',
    completed: 'Completed', archived: 'Archived',
  }

  const selectableProject: SelectableProject = { id: project.id, name: project.name, client_id: project.client_id, client_name: client?.name ?? '' }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
          <Link href="/dashboard/projects" style={{ color: '#EA580C', textDecoration: 'none' }}>Projects</Link>
          {' / '}
          {(project.clients as any)?.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{project.name}</h1>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              {(project.clients as any)?.name}
              {project.started_at && ` · Started ${formatDate(project.started_at)}`}
              {project.planned_end_at && ` · Due ${formatDate(project.planned_end_at)}`}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <span style={{
              fontSize: '12px',
              padding: '4px 12px',
              borderRadius: '10px',
              background: 'var(--brand-50)',
              color: 'var(--brand-800)',
              fontWeight: 500,
            }}>
              {STATUS_LABEL[project.status] || project.status}
            </span>
            {canManageProject && <EditProjectModal project={project} />}
          </div>
        </div>
      </div>

      {/* Team */}
      <div style={{ marginBottom: '20px' }}>
        <ProjectMembersManager
          projectId={project.id}
          initialMembers={projectMembers}
          allTeamMembers={members}
        />
      </div>

      {/* Ticket stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px' }}>
        <StatCard icon={Ticket} label="Open" value={openCount} accent="#0C447C" delayMs={0} />
        <StatCard icon={Loader2} label="In progress" value={inProgressCount} accent="#633806" delayMs={40} />
        <StatCard icon={AlertTriangle} label="Urgent" value={urgentCount} accent="#A32D2D" delayMs={80} />
        <StatCard icon={UserX} label="Unassigned" value={unassignedCount} accent="var(--text-tertiary)" delayMs={120} />
      </div>

      {/* Tickets — scoped to this project only */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
          Tickets
        </div>
        <TicketsBoard
          initialTickets={projectTickets}
          teamMembers={members}
          projects={[selectableProject]}
          projectMemberIds={{ [project.id]: [...memberIds] }}
          currentTeamMemberId={user?.id ?? ''}
          defaultProjectId={project.id}
        />
      </div>

      {/* Danger zone */}
      {canManageProject && (
        <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '0.5px solid var(--border-default)' }}>
          <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Danger zone
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '14px 16px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Delete this project</div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                Tickets linked to this project stay under {client?.name ?? 'the client'}, just without a project link.
              </div>
            </div>
            <DeleteConfirmButton
              entityLabel="project"
              confirmText={project.name}
              cascadeWarning={`This permanently deletes the project "${project.name}" and its team membership list.`}
              action={deleteProject}
              entityId={project.id}
              redirectTo="/dashboard/projects"
            />
          </div>
        </div>
      )}
    </div>
  )
}
