import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

export default async function ProjectsPage() {
  const supabase = createSupabaseServerClient()

  const { data: projects } = await supabase
    .from('projects')
    .select('*, clients(name, id)')
    .order('updated_at', { ascending: false })

  const STATUS_DOT: Record<string, string> = {
    active:          '#3B6D11',
    awaiting_client: '#BA7517',
    awaiting_team:   '#185FA5',
    on_hold:         '#888780',
    completed:       '#3B6D11',
    archived:        '#B4B2A9',
  }

  const STATUS_LABEL: Record<string, string> = {
    active:          'Active',
    awaiting_client: 'Awaiting client',
    awaiting_team:   'Awaiting team',
    on_hold:         'On hold',
    completed:       'Completed',
    archived:        'Archived',
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Projects</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            {projects?.length ?? 0} total
          </p>
        </div>
        <Link
          href="/dashboard/projects/new"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            background: '#EA580C',
            color: '#fff',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          + New project
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
              gap: '14px',
              padding: '12px 16px',
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border-default)',
              borderRadius: '10px',
              textDecoration: 'none',
            }}
          >
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: STATUS_DOT[project.status] || '#888780',
              flexShrink: 0,
            }} />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{project.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                {(project.clients as any)?.name}
                {project.started_at && ` · Started ${formatDate(project.started_at)}`}
              </div>
            </div>

            {project.planned_end_at && (
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                Due {formatDate(project.planned_end_at)}
              </div>
            )}

            <div style={{
              fontSize: '11px',
              padding: '3px 9px',
              borderRadius: '10px',
              background: 'var(--bg-tertiary)',
              color: STATUS_DOT[project.status],
              fontWeight: 500,
              flexShrink: 0,
            }}>
              {STATUS_LABEL[project.status] || project.status}
            </div>
          </Link>
        ))}

        {(!projects || projects.length === 0) && (
          <div style={{
            padding: '48px 32px',
            textAlign: 'center',
            background: 'var(--bg-primary)',
            border: '0.5px solid var(--border-default)',
            borderRadius: '10px',
          }}>
            <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>No projects yet</div>
            <Link
              href="/dashboard/projects/new"
              style={{ fontSize: '13px', color: '#EA580C', textDecoration: 'none' }}
            >
              Create your first project →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
