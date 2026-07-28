import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatDate, formatRelative, formatTicketRef, TICKET_STATUS_CONFIG, TICKET_PRIORITY_COLOR } from '@/lib/utils'
import Link from 'next/link'
import { Ticket, Loader2, AlertTriangle, UserX, FolderOpen, Users, FileSignature, FolderKanban } from 'lucide-react'
import { StatCard } from '@/components/dashboard/StatCard'
import { EmptyState } from '@/components/dashboard/EmptyState'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()

  const [{ data: projects }, { data: pendingApprovals }, { data: tickets }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, status, updated_at, clients(name)')
      .order('updated_at', { ascending: false })
      .limit(6),
    supabase
      .from('approval_links')
      .select('id')
      .eq('status', 'pending'),
    supabase
      .from('tickets')
      .select('id, ref_number, title, status, priority, updated_at, clients(name), ticket_assignees(team_member_id)')
      .order('updated_at', { ascending: false }),
  ])

  const STATUS_COLORS: Record<string, string> = {
    active:           '#3B6D11',
    awaiting_client:  '#BA7517',
    awaiting_team:    '#185FA5',
    on_hold:          'var(--text-tertiary)',
    completed:        '#3B6D11',
    archived:         'var(--text-tertiary)',
  }

  const STATUS_LABELS: Record<string, string> = {
    active:           'Active',
    awaiting_client:  'Awaiting client',
    awaiting_team:    'Awaiting team',
    on_hold:          'On hold',
    completed:        'Completed',
    archived:         'Archived',
  }

  const allTickets = tickets ?? []
  const openTickets = allTickets.filter(t => t.status === 'open')
  const inProgressTickets = allTickets.filter(t => t.status === 'in_progress')
  const activeTickets = [...openTickets, ...inProgressTickets]
  const urgentCount = activeTickets.filter(t => t.priority === 'urgent').length
  const unassignedCount = activeTickets.filter(t => (t.ticket_assignees?.length ?? 0) === 0).length
  const recentTickets = allTickets.slice(0, 5)

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Overview</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Ticket metrics — the heart of the app gets top billing */}
      <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
        Tickets
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '28px' }}>
        <StatCard icon={Ticket} label="Open" value={openTickets.length} accent="#0C447C" href="/dashboard/tickets" delayMs={0} />
        <StatCard icon={Loader2} label="In progress" value={inProgressTickets.length} accent="#633806" href="/dashboard/tickets" delayMs={40} />
        <StatCard icon={AlertTriangle} label="Urgent" value={urgentCount} accent="#A32D2D" href="/dashboard/tickets" delayMs={80} />
        <StatCard icon={UserX} label="Unassigned" value={unassignedCount} accent="var(--text-tertiary)" href="/dashboard/tickets" delayMs={120} />
      </div>

      {/* Project metrics */}
      <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
        Projects &amp; approvals
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '32px' }}>
        <StatCard icon={FolderOpen} label="Active projects" value={projects?.filter(p => p.status === 'active').length ?? 0} accent="#3B6D11" href="/dashboard/projects" delayMs={160} />
        <StatCard icon={Users} label="Awaiting client" value={projects?.filter(p => p.status === 'awaiting_client').length ?? 0} accent="#BA7517" href="/dashboard/projects" delayMs={200} />
        <StatCard icon={FileSignature} label="Pending approvals" value={pendingApprovals?.length ?? 0} accent="var(--brand-600)" delayMs={240} />
      </div>

      {/* Recent tickets */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Recent tickets
        </div>
        <Link href="/dashboard/tickets" style={{ fontSize: '12px', color: 'var(--brand-600)', textDecoration: 'none' }}>
          View all →
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '32px' }}>
        {recentTickets.map((t, i) => {
          const cfg = TICKET_STATUS_CONFIG[t.status] ?? TICKET_STATUS_CONFIG.open
          return (
            <Link
              key={t.id}
              href={`/dashboard/tickets/${t.id}`}
              className="hover-card animate-in"
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '11px 14px', background: 'var(--bg-primary)',
                border: '0.5px solid var(--border-default)', borderRadius: '10px',
                textDecoration: 'none', animationDelay: `${280 + i * 30}ms`,
              }}
            >
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: TICKET_PRIORITY_COLOR[t.priority], flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>{formatTicketRef(t.ref_number)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t.title}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                  {(t.clients as any)?.name}
                </div>
              </div>
              <div style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: cfg.bg, color: cfg.color, fontWeight: 500, flexShrink: 0 }}>
                {cfg.label}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                {formatRelative(t.updated_at)}
              </div>
            </Link>
          )
        })}

        {recentTickets.length === 0 && (
          <EmptyState
            icon={Ticket}
            title="No tickets yet"
            description="Once a client raises one, or you log one on their behalf, it'll show up here."
            actionLabel="Go to Tickets"
            actionHref="/dashboard/tickets"
          />
        )}
      </div>

      {/* Recent projects */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Recent projects
        </div>
        <Link href="/dashboard/projects" style={{ fontSize: '12px', color: 'var(--brand-600)', textDecoration: 'none' }}>
          View all →
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {projects?.map((project, i) => (
          <Link
            key={project.id}
            href={`/dashboard/projects/${project.id}`}
            className="hover-card animate-in"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '11px 14px',
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border-default)',
              borderRadius: '10px',
              textDecoration: 'none',
              animationDelay: `${420 + i * 30}ms`,
            }}
          >
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: STATUS_COLORS[project.status] || 'var(--text-tertiary)',
              flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{project.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                {(project.clients as any)?.name}
              </div>
            </div>
            <div style={{
              fontSize: '10px',
              padding: '2px 8px',
              borderRadius: '10px',
              background: 'var(--bg-tertiary)',
              color: STATUS_COLORS[project.status] || 'var(--text-tertiary)',
              fontWeight: 500,
            }}>
              {STATUS_LABELS[project.status] || project.status}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
              {formatDate(project.updated_at)}
            </div>
          </Link>
        ))}

        {(!projects || projects.length === 0) && (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            actionLabel="Create your first project"
            actionHref="/dashboard/projects"
          />
        )}
      </div>
    </div>
  )
}
