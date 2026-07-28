import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Plus, FolderKanban, FolderOpen, Users, CheckCircle2 } from 'lucide-react'
import { StatCard } from '@/components/dashboard/StatCard'
import { EmptyState } from '@/components/dashboard/EmptyState'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: projects }, { data: me }] = await Promise.all([
    supabase
      .from('projects')
      .select('*, clients(name, id), tickets(count)')
      .order('updated_at', { ascending: false }),
    user ? supabase.from('team_members').select('role').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
  ])

  const canCreate = me?.role === 'admin' || me?.role === 'manager'

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

  const total = projects?.length ?? 0
  const activeCount = projects?.filter(p => p.status === 'active').length ?? 0
  const awaitingCount = projects?.filter(p => p.status === 'awaiting_client' || p.status === 'awaiting_team').length ?? 0
  const completedCount = projects?.filter(p => p.status === 'completed').length ?? 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Projects</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            {total} total
          </p>
        </div>
        {canCreate && (
          <Link
            href="/dashboard/projects/new"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              background: 'var(--brand-600)',
              color: '#fff',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            <Plus size={14} /> New project
          </Link>
        )}
      </div>

      {total > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
          <StatCard icon={FolderOpen} label="Active" value={activeCount} accent="#3B6D11" delayMs={0} />
          <StatCard icon={Users} label="Awaiting a reply" value={awaitingCount} accent="#BA7517" delayMs={40} />
          <StatCard icon={CheckCircle2} label="Completed" value={completedCount} accent="#185FA5" delayMs={80} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {projects?.map((project, i) => {
          const ticketCount = (project.tickets as any)?.[0]?.count ?? 0
          return (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="hover-card animate-in"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '13px 16px',
                background: 'var(--bg-primary)',
                border: '0.5px solid var(--border-default)',
                borderLeft: `3px solid ${STATUS_DOT[project.status] || '#888780'}`,
                borderRadius: '10px',
                textDecoration: 'none',
                animationDelay: `${Math.min(i, 10) * 30}ms`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{project.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                  {(project.clients as any)?.name}
                  {project.started_at && ` · Started ${formatDate(project.started_at)}`}
                </div>
              </div>

              {ticketCount > 0 && (
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                  {ticketCount} ticket{ticketCount !== 1 ? 's' : ''}
                </div>
              )}

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
          )
        })}

        {total === 0 && (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description={canCreate ? 'Create a project to start tracking milestones, decisions, and documents for a client engagement.' : 'An admin or manager needs to create a project before you can start tracking milestones, decisions, and documents.'}
            actionLabel={canCreate ? 'Create your first project' : undefined}
            actionHref={canCreate ? '/dashboard/projects/new' : undefined}
          />
        )}
      </div>
    </div>
  )
}
