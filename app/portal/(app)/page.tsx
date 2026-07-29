import Link from 'next/link'
import { getSessionClient } from '@/lib/portal/session-guard'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { formatDate, PROJECT_STATUS_LABELS, TICKET_STATUS_CONFIG } from '@/lib/utils'
import { FolderKanban } from 'lucide-react'
import { EmptyState } from '@/components/dashboard/EmptyState'

export const dynamic = 'force-dynamic'

export default async function PortalHubPage() {
  const client = await getSessionClient()
  const supabase = createServiceRoleClient()

  const [{ data: tickets }, { data: projects }] = await Promise.all([
    supabase
      .from('tickets')
      .select('id, status')
      .eq('client_id', client.id)
      .eq('ticket_type', 'client'),
    supabase
      .from('projects')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false }),
  ])

  const ticketCounts = {
    open: tickets?.filter(t => t.status === 'open').length ?? 0,
    in_progress: tickets?.filter(t => t.status === 'in_progress').length ?? 0,
    resolved: tickets?.filter(t => t.status === 'resolved').length ?? 0,
    closed: tickets?.filter(t => t.status === 'closed').length ?? 0,
  }
  const openTotal = ticketCounts.open + ticketCounts.in_progress

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="animate-in">
        <h1 style={{ fontSize: '19px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
          Welcome, {client.name}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
          Track your tickets with NuAIg here. Something on your mind? Raise a ticket and we'll get back to you.
        </p>
      </div>

      {/* Tickets summary */}
      <div className="animate-in" style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border-default)',
        borderRadius: '10px',
        padding: '18px 20px',
        animationDelay: '40ms',
      }}>
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>Your tickets</div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            {openTotal > 0 ? `${openTotal} ticket${openTotal === 1 ? '' : 's'} still being worked on` : "Nothing open — you're all caught up"}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {(Object.keys(TICKET_STATUS_CONFIG) as Array<keyof typeof ticketCounts>).map(status => (
            <Link
              key={status}
              href={`/portal/tickets?status=${status}`}
              className="hover-card"
              style={{
                background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '10px 12px',
                textDecoration: 'none', display: 'block',
              }}
            >
              <div style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)' }}>{ticketCounts[status]}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                {TICKET_STATUS_CONFIG[status].label}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Projects */}
      <div>
        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
          Your projects
        </div>

        {(projects ?? []).length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Once NuAIg starts an engagement with you, it'll show up here."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(projects ?? []).map((project, i) => (
              <Link
                key={project.id}
                href={`/portal/projects/${project.id}`}
                className="hover-card animate-in"
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '13px 16px', background: 'var(--bg-primary)',
                  border: '0.5px solid var(--border-default)', borderRadius: '10px',
                  textDecoration: 'none', animationDelay: `${80 + i * 30}ms`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{project.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    {project.started_at && `Started ${formatDate(project.started_at)}`}
                    {project.planned_end_at && ` · Due ${formatDate(project.planned_end_at)}`}
                  </div>
                </div>
                <span style={{
                  fontSize: '11px', padding: '3px 10px', borderRadius: '10px',
                  background: 'var(--brand-50)', color: 'var(--brand-800)', fontWeight: 500, flexShrink: 0,
                }}>
                  {PROJECT_STATUS_LABELS[project.status] ?? project.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
