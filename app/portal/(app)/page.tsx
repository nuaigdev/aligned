import Link from 'next/link'
import { getSessionClient } from '@/lib/portal/session-guard'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { PROJECT_STATUS_LABELS } from '@/lib/utils'
import { TICKET_STATUS_CONFIG } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function PortalHubPage() {
  const client = await getSessionClient()
  const supabase = createServiceRoleClient()

  const [{ data: projects }, { data: tickets }] = await Promise.all([
    supabase
      .from('projects')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('tickets')
      .select('id, status')
      .eq('client_id', client.id),
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
      {/* Tickets summary */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border-default)',
        borderRadius: '10px',
        padding: '18px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>Tickets</div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
              {openTotal > 0 ? `${openTotal} open ticket${openTotal === 1 ? '' : 's'}` : 'Nothing open right now'}
            </div>
          </div>
          <Link
            href="/portal/tickets/new"
            style={{
              fontSize: '13px', fontWeight: 500, color: '#fff', background: '#EA580C',
              padding: '8px 14px', borderRadius: '8px', textDecoration: 'none',
            }}
          >
            + New ticket
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {(Object.keys(TICKET_STATUS_CONFIG) as Array<keyof typeof ticketCounts>).map(status => (
            <Link
              key={status}
              href={`/portal/tickets?status=${status}`}
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
          Projects
        </div>

        {(projects ?? []).length === 0 ? (
          <div style={{
            padding: '32px', textAlign: 'center', background: 'var(--bg-primary)',
            border: '0.5px solid var(--border-default)', borderRadius: '10px',
            fontSize: '13px', color: 'var(--text-tertiary)',
          }}>
            No projects yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(projects ?? []).map(project => (
              <Link
                key={project.id}
                href={`/portal/projects/${project.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '13px 16px', background: 'var(--bg-primary)',
                  border: '0.5px solid var(--border-default)', borderRadius: '10px',
                  textDecoration: 'none',
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
