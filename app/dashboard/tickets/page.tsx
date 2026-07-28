import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Ticket, Loader2, AlertTriangle, UserX } from 'lucide-react'
import { StatCard } from '@/components/dashboard/StatCard'
import TicketsBoard from './TicketsBoard'
import type { BoardTicket } from './TicketCard'

export const dynamic = 'force-dynamic'

export default async function TicketsPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: rawTickets, error: ticketsError }, { data: teamMembers }, { data: clients }, { data: projects }] = await Promise.all([
    supabase
      .from('tickets')
      .select(`
        *,
        clients(name),
        ticket_assignees(team_member_id, team_members!ticket_assignees_team_member_id_fkey(id, name, role, manager_id, email, is_active, created_at, updated_at)),
        ticket_comments(count)
      `)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase.from('team_members').select('*').eq('is_active', true).order('name'),
    supabase.from('clients').select('*').order('name'),
    supabase.from('projects').select('*').order('name'),
  ])

  if (ticketsError) {
    // Surface loudly rather than silently rendering an empty board — this
    // exact failure mode (a swallowed PostgREST embed error) is what caused
    // "tickets exist but the page shows none" before.
    console.error('Failed to load tickets:', ticketsError)
  }

  const tickets: BoardTicket[] = (rawTickets ?? []).map((t: any) => ({
    ...t,
    client_name: t.clients?.name,
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
          {tickets.length} ticket{tickets.length === 1 ? '' : 's'} visible to you
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
        clients={clients ?? []}
        projects={projects ?? []}
        currentTeamMemberId={user.id}
      />
    </div>
  )
}
