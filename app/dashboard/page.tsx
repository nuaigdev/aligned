import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatRelative, formatTicketRef, ticketClientCode, TICKET_STATUS_CONFIG, TICKET_PRIORITY_COLOR } from '@/lib/utils'
import { getMyProjectScope, scopeProjectsQuery } from '@/lib/projects/scope'
import Link from 'next/link'
import {
  AlertTriangle, UserX, Ticket, FolderKanban, PartyPopper, CheckCircle2, User, CalendarClock, ArrowRight,
} from 'lucide-react'
import { StatCard } from '@/components/dashboard/StatCard'

export const dynamic = 'force-dynamic'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
const STATUS_ORDER = ['open', 'in_progress', 'resolved', 'closed'] as const

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Both projects and this page's ticket sections are scoped the same way
  // the Tickets page scopes its own default "my projects" view (RLS still
  // lets any team member read any ticket by id/search — this is a display
  // default, not a security boundary, matching app/dashboard/tickets/page.tsx
  // exactly): admins see everything; everyone else sees projects/tickets
  // from their own project memberships, clients they manage, tickets they
  // raised, and tickets they're assigned to.
  const scope = user
    ? await getMyProjectScope(supabase, user.id)
    : { isAdmin: false, isManager: false, name: null, projectIds: [], managedClientIds: [] }

  const [{ data: myAssignments }, projectsResult] = await Promise.all([
    user && !scope.isAdmin
      ? supabase.from('ticket_assignees').select('ticket_id').eq('team_member_id', user.id)
      : Promise.resolve({ data: [] as { ticket_id: string }[] }),
    (() => {
      const projectsBaseQuery = supabase
        .from('projects')
        .select('id, name, status, updated_at, clients(name)')
        .order('updated_at', { ascending: false })
        .limit(6)
      const scopedProjectsQuery = scopeProjectsQuery(projectsBaseQuery, scope)
      return scopedProjectsQuery ? scopedProjectsQuery : Promise.resolve({ data: [] as any[] })
    })(),
  ])
  const projects = projectsResult.data

  let ticketsQuery = supabase
    .from('tickets')
    .select('id, ref_number, title, status, priority, due_date, resolved_at, updated_at, project_id, client_id, created_by_team_member_id, clients(name, slug), ticket_assignees(team_member_id)')
    .order('updated_at', { ascending: false })

  if (user && !scope.isAdmin) {
    const myAssignedTicketIds = (myAssignments ?? []).map(r => r.ticket_id)
    const orParts = [`created_by_team_member_id.eq.${user.id}`]
    if (scope.projectIds.length) orParts.push(`project_id.in.(${scope.projectIds.join(',')})`)
    if (scope.managedClientIds.length) orParts.push(`client_id.in.(${scope.managedClientIds.join(',')})`)
    if (myAssignedTicketIds.length) orParts.push(`id.in.(${myAssignedTicketIds.join(',')})`)
    ticketsQuery = ticketsQuery.or(orParts.join(','))
  }

  const { data: tickets } = await ticketsQuery

  const me = { name: scope.name }

  const allTickets = tickets ?? []
  const activeTickets = allTickets.filter(t => t.status === 'open' || t.status === 'in_progress')
  const urgentTickets = activeTickets.filter(t => t.priority === 'urgent')
  const unassignedTickets = activeTickets.filter(t => ((t.ticket_assignees as any[]) ?? []).length === 0)

  const myId = user?.id
  const myTickets = myId
    ? activeTickets
        .filter(t => ((t.ticket_assignees as any[]) ?? []).some(a => a.team_member_id === myId))
        .sort((a, b) => (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) || (new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()))
    : []

  const openCount = allTickets.filter(t => t.status === 'open').length
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const resolvedThisWeek = allTickets.filter(t => t.resolved_at && new Date(t.resolved_at).getTime() >= weekAgo).length

  const statusCounts = STATUS_ORDER.map(status => ({ status, count: allTickets.filter(t => t.status === status).length }))
  const statusTotal = allTickets.length

  function isOverdue(dueDate: string | null): boolean {
    return !!dueDate && new Date(dueDate) < new Date(new Date().toDateString())
  }

  // A single prioritized "needs you" feed — urgent tickets first, then
  // unassigned ones (deduped). Approvals are gone: milestones/decisions are
  // paused, so approval_links no longer has a live source to point at.
  type AttentionItem = { key: string; label: string; sublabel: string; href: string; tone: 'danger' | 'warning' }
  const seen = new Set<string>()
  const attention: AttentionItem[] = []

  for (const t of urgentTickets) {
    if (attention.length >= 5) break
    seen.add(t.id)
    attention.push({
      key: t.id, label: t.title, href: `/dashboard/tickets/${t.id}`,
      sublabel: `${(t.clients as any)?.name ?? 'Unknown client'} · Urgent`, tone: 'danger',
    })
  }
  for (const t of unassignedTickets) {
    if (attention.length >= 5 || seen.has(t.id)) continue
    attention.push({
      key: t.id, label: t.title, href: `/dashboard/tickets/${t.id}`,
      sublabel: `${(t.clients as any)?.name ?? 'Unknown client'} · Unassigned`, tone: 'warning',
    })
  }

  // One merged, time-ordered activity stream instead of two separate
  // "recent tickets" / "recent projects" lists.
  type ActivityItem = { key: string; kind: 'ticket' | 'project'; title: string; ref: string | null; sublabel: string; date: string; href: string; status: string }
  const activity: ActivityItem[] = [
    ...allTickets.slice(0, 8).map(t => ({
      key: `ticket-${t.id}`, kind: 'ticket' as const, title: t.title,
      ref: formatTicketRef(t.ref_number, (t.clients as any)?.slug ? ticketClientCode((t.clients as any).slug) : undefined),
      sublabel: (t.clients as any)?.name ?? '', date: t.updated_at, href: `/dashboard/tickets/${t.id}`, status: t.status,
    })),
    ...(projects ?? []).map(p => ({
      key: `project-${p.id}`, kind: 'project' as const, title: p.name, ref: null,
      sublabel: (p.clients as any)?.name ?? '', date: p.updated_at, href: `/dashboard/projects/${p.id}`, status: p.status,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8)

  const toneStyle = {
    danger:  { bg: 'var(--danger-bg)', color: 'var(--danger-text)' },
    warning: { bg: 'var(--warning-bg)', color: 'var(--warning-text)' },
  }

  return (
    <div>
      <div className="animate-in" style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
            {greeting()}{me?.name ? `, ${me.name.split(' ')[0]}` : ''}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link
          href="/dashboard/tickets"
          className="hover-lift"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', flexShrink: 0,
            background: 'var(--brand-600)', color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: 500, textDecoration: 'none',
          }}
        >
          + New ticket
        </Link>
      </div>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px' }}>
        <StatCard icon={User} label="Assigned to me" value={myTickets.length} accent="var(--brand-600)" href="/dashboard/tickets" delayMs={0} />
        <StatCard icon={Ticket} label="Open" value={openCount} accent="#0C447C" href="/dashboard/tickets" delayMs={40} />
        <StatCard icon={AlertTriangle} label="Urgent" value={urgentTickets.length} accent="#A32D2D" href="/dashboard/tickets" delayMs={80} />
        <StatCard icon={CheckCircle2} label="Resolved this week" value={resolvedThisWeek} accent="#3B6D11" href="/dashboard/tickets" delayMs={120} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '20px', marginBottom: '24px', alignItems: 'start' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
              Needs your attention
            </div>

            {attention.length === 0 ? (
              <div className="animate-in" style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 18px',
                background: 'var(--success-bg)', borderRadius: '10px', color: 'var(--success-text)',
              }}>
                <PartyPopper size={18} />
                <span style={{ fontSize: '13px', fontWeight: 500 }}>Nothing urgent or unassigned right now. You're caught up.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {attention.map((item, i) => {
                  const tone = toneStyle[item.tone]
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className="hover-card animate-in"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
                        background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px',
                        textDecoration: 'none', animationDelay: `${i * 30}ms`,
                      }}
                    >
                      <div style={{
                        width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
                        background: tone.bg, color: tone.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {item.tone === 'danger' ? <AlertTriangle size={14} /> : <UserX size={14} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '1px' }}>{item.sublabel}</div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Assigned to me
              </div>
              {myTickets.length > 0 && (
                <Link href="/dashboard/tickets" style={{ fontSize: '11px', color: 'var(--brand-600)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  View board <ArrowRight size={11} />
                </Link>
              )}
            </div>

            {myTickets.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                Nothing assigned to you right now.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {myTickets.slice(0, 6).map((t, i) => {
                  const overdue = isOverdue(t.due_date)
                  return (
                    <Link
                      key={t.id}
                      href={`/dashboard/tickets/${t.id}`}
                      className="hover-card animate-in"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
                        background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '8px',
                        textDecoration: 'none', animationDelay: `${i * 25}ms`,
                      }}
                    >
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, background: TICKET_PRIORITY_COLOR[t.priority] }} />
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-geist-mono, monospace)', flexShrink: 0 }}>
                        {formatTicketRef(t.ref_number, (t.clients as any)?.slug ? ticketClientCode((t.clients as any).slug) : undefined)}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.title}
                      </span>
                      {overdue && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', padding: '2px 7px', borderRadius: '8px', background: 'var(--danger-bg)', color: 'var(--danger-text)', fontWeight: 500, flexShrink: 0 }}>
                          <CalendarClock size={10} /> Overdue
                        </span>
                      )}
                      <span style={{
                        fontSize: '10px', padding: '2px 8px', borderRadius: '10px', flexShrink: 0, fontWeight: 500,
                        background: TICKET_STATUS_CONFIG[t.status]?.bg, color: TICKET_STATUS_CONFIG[t.status]?.color,
                      }}>
                        {TICKET_STATUS_CONFIG[t.status]?.label ?? t.status}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="animate-in" style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
              Tickets by status
            </div>

            {statusTotal === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>No tickets yet.</div>
            ) : (
              <>
                <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', gap: '2px', background: 'var(--bg-tertiary)' }}>
                  {statusCounts.filter(s => s.count > 0).map(s => (
                    <div
                      key={s.status}
                      title={`${TICKET_STATUS_CONFIG[s.status]?.label}: ${s.count}`}
                      style={{ flex: s.count, background: TICKET_STATUS_CONFIG[s.status]?.color, borderRadius: '3px' }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '14px' }}>
                  {statusCounts.map(s => (
                    <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: TICKET_STATUS_CONFIG[s.status]?.color }} />
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1 }}>{TICKET_STATUS_CONFIG[s.status]?.label}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{s.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="animate-in" style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Projects
              </div>
              <Link href="/dashboard/projects" style={{ fontSize: '11px', color: 'var(--brand-600)', textDecoration: 'none' }}>
                View all
              </Link>
            </div>

            {(projects ?? []).length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>No projects yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {(projects ?? []).slice(0, 5).map(p => (
                  <Link
                    key={p.id}
                    href={`/dashboard/projects/${p.id}`}
                    className="hover-card"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px',
                      borderRadius: '7px', textDecoration: 'none',
                    }}
                  >
                    <FolderKanban size={13} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unified activity stream */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
          Recent activity
        </div>

        {activity.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
            Nothing's happened yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {activity.map((item, i) => (
              <Link
                key={item.key}
                href={item.href}
                className="hover-card animate-in"
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
                  background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '8px',
                  textDecoration: 'none', animationDelay: `${i * 25}ms`,
                }}
              >
                <div style={{
                  width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                  background: item.kind === 'ticket' ? 'var(--brand-50)' : 'var(--info-bg)',
                  color: item.kind === 'ticket' ? 'var(--brand-800)' : 'var(--info-text)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.kind === 'ticket' ? <Ticket size={12} /> : <FolderKanban size={12} />}
                </div>
                {item.ref && (
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-geist-mono, monospace)', flexShrink: 0 }}>
                    {item.ref}
                  </span>
                )}
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.title}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>{item.sublabel}</span>
                <span style={{
                  fontSize: '10px', padding: '2px 8px', borderRadius: '10px', flexShrink: 0, fontWeight: 500,
                  background: item.kind === 'ticket' ? (TICKET_STATUS_CONFIG[item.status]?.bg ?? 'var(--bg-tertiary)') : 'var(--bg-tertiary)',
                  color: item.kind === 'ticket' ? (TICKET_STATUS_CONFIG[item.status]?.color ?? 'var(--text-tertiary)') : 'var(--text-tertiary)',
                }}>
                  {item.kind === 'ticket' ? (TICKET_STATUS_CONFIG[item.status]?.label ?? item.status) : item.status.replace('_', ' ')}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0 }}>{formatRelative(item.date)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
