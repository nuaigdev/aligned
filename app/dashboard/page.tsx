import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()

  const [{ data: projects }, { data: pendingApprovals }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, status, updated_at, clients(name)')
      .order('updated_at', { ascending: false })
      .limit(8),
    supabase
      .from('approval_links')
      .select('id')
      .eq('status', 'pending'),
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

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Overview</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '28px' }}>
        {[
          { label: 'Active projects', value: projects?.filter(p => p.status === 'active').length ?? 0 },
          { label: 'Awaiting client', value: projects?.filter(p => p.status === 'awaiting_client').length ?? 0 },
          { label: 'Pending approvals', value: pendingApprovals?.length ?? 0 },
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'var(--bg-primary)',
            border: '0.5px solid var(--border-default)',
            borderRadius: '10px',
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>{stat.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 500, color: 'var(--text-primary)' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Recent projects */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Recent projects
        </div>
        <Link href="/dashboard/projects" style={{ fontSize: '12px', color: '#EA580C', textDecoration: 'none' }}>
          View all →
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {projects?.map(project => (
          <Link
            key={project.id}
            href={`/dashboard/projects/${project.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '11px 14px',
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border-default)',
              borderRadius: '10px',
              textDecoration: 'none',
              transition: 'border-color .12s',
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
          <div style={{
            padding: '32px',
            textAlign: 'center',
            background: 'var(--bg-primary)',
            border: '0.5px solid var(--border-default)',
            borderRadius: '10px',
          }}>
            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>No projects yet.</div>
            <Link href="/dashboard/projects" style={{ fontSize: '13px', color: '#EA580C', textDecoration: 'none', display: 'block', marginTop: '6px' }}>
              Create your first project →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
