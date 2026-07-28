import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TicketsBoard from './TicketsBoard'
import type { BoardTicket } from './TicketCard'

export const dynamic = 'force-dynamic'

export default async function TicketsPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: rawTickets }, { data: teamMembers }, { data: clients }, { data: projects }] = await Promise.all([
    supabase
      .from('tickets')
      .select(`
        *,
        clients(name),
        ticket_assignees(team_member_id, team_members(id, name, role, manager_id, email, is_active, created_at, updated_at)),
        ticket_comments(count)
      `)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase.from('team_members').select('*').eq('is_active', true).order('name'),
    supabase.from('clients').select('*').order('name'),
    supabase.from('projects').select('*').order('name'),
  ])

  const tickets: BoardTicket[] = (rawTickets ?? []).map((t: any) => ({
    ...t,
    client_name: t.clients?.name,
    assignee_members: (t.ticket_assignees ?? []).map((a: any) => a.team_members).filter(Boolean),
    comment_count: t.ticket_comments?.[0]?.count ?? 0,
  }))

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Tickets</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
          {tickets.length} ticket{tickets.length === 1 ? '' : 's'} visible to you
        </p>
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
