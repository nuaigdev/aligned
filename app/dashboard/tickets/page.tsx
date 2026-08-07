import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Ticket, Loader2, AlertTriangle, UserX } from 'lucide-react'
import { StatCard } from '@/components/dashboard/StatCard'
import TicketsBoard from './TicketsBoard'
import type { BoardTicket } from './TicketCard'
import type { SelectableProject } from './TicketsBoard'

export const dynamic = 'force-dynamic'

export default async function TicketsPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/nuaig-login')

  const { data: me } = await supabase.from('team_members').select('role').eq('id', user.id).maybeSingle()
  const isAdmin = me?.role === 'admin'
  const isManager = me?.role === 'manager'

  const [{ data: myMemberships }, { data: managedClients }, { data: myAssignments }] = await Promise.all([
    isAdmin ? Promise.resolve({ data: [] }) : supabase.from('project_members').select('project_id').eq('team_member_id', user.id),
    isAdmin || !isManager ? Promise.resolve({ data: [] }) : supabase.from('clients').select('id').eq('manager_id', user.id),
    isAdmin ? Promise.resolve({ data: [] }) : supabase.from('ticket_assignees').select('ticket_id').eq('team_member_id', user.id),
  ])

  const myProjectIds = (myMemberships ?? []).map(r => r.project_id)
  const managedClientIds = (managedClients ?? []).map(c => c.id)
  const myAssignedTicketIds = (myAssignments ?? []).map(r => r.ticket_id)

  // Tickets are viewable by anyone (migration 038) — this is a display
  // scope, not a security boundary. Admins see everything; everyone else
  // sees tickets from their own projects, clients they manage, tickets
  // they raised, and tickets they're assigned to. Anything outside that is
  // still reachable via the "search all tickets" ticket-number lookup.
  let ticketsQuery = supabase
    .from('tickets')
    .select(`
      *,
      clients(name, slug),
      ticket_assignees(team_member_id, team_members!ticket_assignees_team_member_id_fkey(id, name, role, manager_id, email, is_active, created_at, updated_at)),
      ticket_comments(count)
    `)

  if (!isAdmin) {
    const orParts = [`created_by_team_member_id.eq.${user.id}`]
    if (myProjectIds.length) orParts.push(`project_id.in.(${myProjectIds.join(',')})`)
    if (managedClientIds.length) orParts.push(`client_id.in.(${managedClientIds.join(',')})`)
    if (myAssignedTicketIds.length) orParts.push(`id.in.(${myAssignedTicketIds.join(',')})`)
    ticketsQuery = ticketsQuery.or(orParts.join(','))
  }

  const [{ data: rawTickets, error: ticketsError }, { data: teamMembers }, { data: rawProjects }] = await Promise.all([
    ticketsQuery.order('position', { ascending: true }).order('created_at', { ascending: false }),
    supabase.from('team_members').select('*').eq('is_active', true).order('name'),
    supabase.from('projects').select('id, name, client_id, clients(name)').order('name'),
  ])

  if (ticketsError) {
    // Surface loudly rather than silently rendering an empty board — this
    // exact failure mode (a swallowed PostgREST embed error) is what caused
    // "tickets exist but the page shows none" before.
    console.error('Failed to load tickets:', ticketsError)
  }

  const allProjects: SelectableProject[] = (rawProjects ?? []).map((p: any) => ({
    id: p.id, name: p.name, client_id: p.client_id, client_name: p.clients?.name ?? '',
  }))

  // Projects selectable in "New ticket": any project for an admin; for
  // everyone else, projects they're a member of or that belong to a client
  // they manage (matches the ticket-creation RLS check in migration 038).
  const selectableProjects = isAdmin
    ? allProjects
    : allProjects.filter(p => myProjectIds.includes(p.id) || managedClientIds.includes(p.client_id))

  const selectableProjectIds = selectableProjects.map(p => p.id)
  const { data: pmRows } = selectableProjectIds.length
    ? await supabase.from('project_members').select('project_id, team_member_id').in('project_id', selectableProjectIds)
    : { data: [] as { project_id: string; team_member_id: string }[] }

  const projectMemberIds: Record<string, string[]> = {}
  for (const row of pmRows ?? []) {
    (projectMemberIds[row.project_id] ??= []).push(row.team_member_id)
  }

  const tickets: BoardTicket[] = (rawTickets ?? []).map((t: any) => ({
    ...t,
    client_name: t.clients?.name,
    client_slug: t.clients?.slug,
    assignee_members: (t.ticket_assignees ?? []).map((a: any) => a.team_members).filter(Boolean),
    comment_count: t.ticket_comments?.[0]?.count ?? 0,
  }))

  const openCount = tickets.filter(t => t.status === 'open').length
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length
  const activeTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress')
  const urgentCount = activeTickets.filter(t => t.priority === 'urgent').length
  const unassignedCount = activeTickets.filter(t => (t.assignee_members ?? []).length === 0).length

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Tickets</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
          {tickets.length} ticket{tickets.length === 1 ? '' : 's'} across your projects
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px' }}>
        <StatCard icon={Ticket} label="Open" value={openCount} accent="#0C447C" delayMs={0} />
        <StatCard icon={Loader2} label="In progress" value={inProgressCount} accent="#633806" delayMs={40} />
        <StatCard icon={AlertTriangle} label="Urgent" value={urgentCount} accent="#A32D2D" delayMs={80} />
        <StatCard icon={UserX} label="Unassigned" value={unassignedCount} accent="var(--text-tertiary)" delayMs={120} />
      </div>

      <TicketsBoard
        initialTickets={tickets}
        teamMembers={teamMembers ?? []}
        projects={selectableProjects}
        projectMemberIds={projectMemberIds}
        currentTeamMemberId={user.id}
      />
    </div>
  )
}
