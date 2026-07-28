import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatDate, formatDecisionRef, formatRelative } from '@/lib/utils'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import CopyButton from './CopyButton'
import DeleteConfirmButton from '@/components/dashboard/DeleteConfirmButton'
import { deleteProject } from '@/lib/projects/actions'
import TicketsBoard from '@/app/dashboard/tickets/TicketsBoard'
import type { BoardTicket } from '@/app/dashboard/tickets/TicketCard'

export const dynamic = 'force-dynamic'

export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: project } = await supabase
    .from('projects')
    .select('*, clients(id, name, slug, login_id, manager_id, must_change_password, last_login_at, last_portal_seen_at, created_at, updated_at)')
    .eq('id', params.projectId)
    .single()

  if (!project) notFound()

  const [
    { data: milestones },
    { data: decisions },
    { data: documents },
    { data: pendingApprovals },
    { data: recentMilestones },
    { data: recentDecisions },
    { data: recentDocuments },
    { data: me },
    { data: rawTickets },
    { data: teamMembers },
  ] = await Promise.all([
    supabase.from('milestones').select('*').eq('project_id', params.projectId).order('sort_order'),
    supabase.from('decisions').select('*').eq('project_id', params.projectId).order('ref_number', { ascending: false }),
    supabase.from('documents').select('*').eq('project_id', params.projectId).order('created_at', { ascending: false }),
    supabase.from('approval_links').select('id').eq('project_id', params.projectId).eq('status', 'pending'),
    supabase.from('milestones').select('id, title, status, updated_at, type').eq('project_id', params.projectId).order('updated_at', { ascending: false }).limit(6),
    supabase.from('decisions').select('id, ref_number, title, status, updated_at').eq('project_id', params.projectId).order('updated_at', { ascending: false }).limit(6),
    supabase.from('documents').select('id, name, created_at, shared_by').eq('project_id', params.projectId).order('created_at', { ascending: false }).limit(6),
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
  ])

  const canManageProject = me?.role === 'admin' || me?.role === 'manager'

  const projectTickets: BoardTicket[] = (rawTickets ?? []).map((t: any) => ({
    ...t,
    client_name: t.clients?.name,
    client_slug: t.clients?.slug,
    assignee_members: (t.ticket_assignees ?? []).map((a: any) => a.team_members).filter(Boolean),
    comment_count: t.ticket_comments?.[0]?.count ?? 0,
  }))

  const completed = milestones?.filter(m => m.status === 'completed').length ?? 0
  const total = milestones?.length ?? 0
  // Progress is weighted by each milestone's assigned percentage of the
  // project, not a flat completed/total count — a milestone worth 40% moves
  // the bar more than one worth 5%.
  const progress = Math.min(100, (milestones ?? []).filter(m => m.status === 'completed').reduce((sum, m) => sum + (m.percentage ?? 0), 0))
  const client = project.clients as any
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const portalDeepLink = `${appUrl}/portal/projects/${project.id}`

  const STATUS_LABEL: Record<string, string> = {
    active: 'Active', awaiting_client: 'Awaiting client',
    awaiting_team: 'Awaiting team', on_hold: 'On hold',
    completed: 'Completed', archived: 'Archived',
  }

  const MS_STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
    not_started:      { label: 'Not started',       bg: 'var(--bg-tertiary)',  color: 'var(--text-tertiary)' },
    in_progress:      { label: 'In progress',       bg: 'var(--info-bg)',      color: 'var(--info-text)' },
    awaiting_signoff: { label: 'Awaiting sign-off', bg: 'var(--warning-bg)',   color: 'var(--warning-text)' },
    completed:        { label: 'Completed',          bg: 'var(--success-bg)',   color: 'var(--success-text)' },
    reopened:         { label: 'Reopened',           bg: 'var(--warning-bg)',   color: 'var(--warning-text)' },
  }

  const DEC_STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
    draft:            { label: 'Draft',            bg: 'var(--bg-tertiary)',  color: 'var(--text-tertiary)' },
    pending_approval: { label: 'Pending approval', bg: 'var(--warning-bg)',   color: 'var(--warning-text)' },
    approved:         { label: 'Approved',         bg: 'var(--success-bg)',   color: 'var(--success-text)' },
    amended:          { label: 'Amended',          bg: 'var(--info-bg)',      color: 'var(--info-text)' },
  }

  type ActivityItem =
    | { kind: 'milestone'; id: string; title: string; status: string; date: string }
    | { kind: 'decision';  id: string; ref: number; title: string; status: string; date: string }
    | { kind: 'document';  id: string; name: string; shared_by: string; date: string }

  const activityItems: ActivityItem[] = [
    ...(recentMilestones ?? []).map(m => ({
      kind: 'milestone' as const,
      id: m.id, title: m.title, status: m.status, date: m.updated_at,
    })),
    ...(recentDecisions ?? []).map(d => ({
      kind: 'decision' as const,
      id: d.id, ref: d.ref_number, title: d.title, status: d.status, date: d.updated_at,
    })),
    ...(recentDocuments ?? []).map(doc => ({
      kind: 'document' as const,
      id: doc.id, name: doc.name, shared_by: doc.shared_by, date: doc.created_at,
    })),
  ]
  activityItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const topActivity = activityItems.slice(0, 6)

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
        </div>
      </div>

      {/* Client access */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border-default)',
        borderRadius: '10px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '20px',
      }}>
        <ExternalLink size={14} color="#EA580C" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>
            {client?.login_id ? 'Client logs in with' : 'No client login issued yet'}
          </div>
          <div style={{ fontSize: '12px', color: '#EA580C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {client?.login_id ?? (
              <Link href={`/dashboard/clients/${client?.id}`} style={{ color: '#EA580C' }}>
                Set one up on the client page →
              </Link>
            )}
          </div>
        </div>
        {client?.login_id && <CopyButton text={client.login_id} />}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '24px' }}>
        {[
          { label: 'Progress', value: `${progress}%` },
          { label: 'Milestones', value: `${completed} / ${total}` },
          { label: 'Decisions', value: decisions?.length ?? 0 },
          { label: 'Pending approvals', value: pendingApprovals?.length ?? 0 },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '12px 14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '3px' }}>{s.label}</div>
            <div style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '14px 16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Overall progress</span>
          <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>{progress}%</span>
        </div>
        <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: '#EA580C', borderRadius: '3px', transition: 'width .3s' }} />
        </div>
      </div>

      {/* Quick nav cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '24px' }}>
        {[
          {
            href: `/dashboard/projects/${project.id}/milestones`,
            label: 'Milestones',
            subtitle: 'Manage & track',
            count: total,
            desc: `${completed} completed`,
          },
          {
            href: `/dashboard/projects/${project.id}/decisions`,
            label: 'Decisions',
            subtitle: 'Log & approve',
            count: decisions?.length ?? 0,
            desc: `${decisions?.filter(d => d.status === 'approved').length ?? 0} signed`,
          },
          {
            href: `/dashboard/projects/${project.id}/documents`,
            label: 'Documents',
            subtitle: 'Upload & share',
            count: documents?.length ?? 0,
            desc: 'All project files',
          },
        ].map(item => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'block',
              padding: '16px',
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border-default)',
              borderRadius: '10px',
              textDecoration: 'none',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <div style={{ position: 'absolute', top: '14px', right: '14px', fontSize: '14px', color: 'var(--text-tertiary)' }}>→</div>
            <div style={{ fontSize: '22px', fontWeight: 500, color: '#EA580C', marginBottom: '2px' }}>{item.count}</div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{item.label}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{item.subtitle}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>{item.desc}</div>
          </Link>
        ))}
      </div>

      {/* Tickets — scoped to this project only; a ticket can also exist at
          just the client level with no project link, so this is a subset of
          that client's full ticket list, not the whole thing. */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
          Tickets
        </div>
        <TicketsBoard
          initialTickets={projectTickets}
          teamMembers={teamMembers ?? []}
          clients={client ? [client] : []}
          projects={[project as any]}
          currentTeamMemberId={user?.id ?? ''}
        />
      </div>

      {/* Recent activity */}
      {topActivity.length > 0 && (
        <div>
          <div style={{
            fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            marginBottom: '10px',
          }}>
            Recent activity
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {topActivity.map(item => {
              if (item.kind === 'milestone') {
                const cfg = MS_STATUS_CONFIG[item.status] ?? MS_STATUS_CONFIG.not_started
                return (
                  <div key={`ms-${item.id}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '14px', flexShrink: 0 }}>🏁</span>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: cfg.bg, color: cfg.color, fontWeight: 500, flexShrink: 0 }}>{cfg.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>{formatRelative(item.date)}</span>
                  </div>
                )
              }
              if (item.kind === 'decision') {
                const cfg = DEC_STATUS_CONFIG[item.status] ?? DEC_STATUS_CONFIG.draft
                return (
                  <div key={`dec-${item.id}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '14px', flexShrink: 0 }}>📋</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>{formatDecisionRef(item.ref)}</span>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: cfg.bg, color: cfg.color, fontWeight: 500, flexShrink: 0 }}>{cfg.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>{formatRelative(item.date)}</span>
                  </div>
                )
              }
              return (
                <div key={`doc-${item.id}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '14px', flexShrink: 0 }}>📄</span>
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', fontWeight: 500, flexShrink: 0 }}>Uploaded</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>{formatRelative(item.date)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
              cascadeWarning={`This permanently deletes ${total} milestone(s), ${decisions?.length ?? 0} decision(s), and ${documents?.length ?? 0} document(s) for ${project.name}.`}
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
