import { createSupabaseServerClient } from '@/lib/supabase/server'
import { formatRelative, TICKET_STATUS_CONFIG } from '@/lib/utils'
import Link from 'next/link'
import { AlertTriangle, UserX, FileSignature, Ticket, FolderKanban, PartyPopper } from 'lucide-react'

export const dynamic = 'force-dynamic'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: me }, { data: tickets }, { data: projects }, { data: pendingApprovals }] = await Promise.all([
    user ? supabase.from('team_members').select('name').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase
      .from('tickets')
      .select('id, ref_number, title, status, priority, updated_at, clients(name), ticket_assignees(count)')
      .order('updated_at', { ascending: false }),
    supabase
      .from('projects')
      .select('id, name, status, updated_at, clients(name)')
      .order('updated_at', { ascending: false })
      .limit(6),
    supabase.from('approval_links').select('id').eq('status', 'pending'),
  ])

  const allTickets = tickets ?? []
  const activeTickets = allTickets.filter(t => t.status === 'open' || t.status === 'in_progress')
  const urgentTickets = activeTickets.filter(t => t.priority === 'urgent')
  const unassignedTickets = activeTickets.filter(t => ((t.ticket_assignees as any)?.[0]?.count ?? 0) === 0)
  const pendingCount = pendingApprovals?.length ?? 0

  // A single prioritized "needs you" feed instead of separate stat grids —
  // urgent tickets first, then unassigned ones (deduped), then a rollup for
  // pending approvals (which don't have one single obvious destination page).
  type AttentionItem = { key: string; label: string; sublabel: string; href: string; tone: 'danger' | 'warning' | 'info' }
  const seen = new Set<string>()
  const attention: AttentionItem[] = []

  for (const t of urgentTickets) {
    if (attention.length >= 6) break
    seen.add(t.id)
    attention.push({
      key: t.id, label: t.title, href: `/dashboard/tickets/${t.id}`,
      sublabel: `${(t.clients as any)?.name ?? 'Unknown client'} · Urgent`, tone: 'danger',
    })
  }
  for (const t of unassignedTickets) {
    if (attention.length >= 6 || seen.has(t.id)) continue
    attention.push({
      key: t.id, label: t.title, href: `/dashboard/tickets/${t.id}`,
      sublabel: `${(t.clients as any)?.name ?? 'Unknown client'} · Unassigned`, tone: 'warning',
    })
  }
  if (pendingCount > 0) {
    attention.push({
      key: 'approvals', label: `${pendingCount} approval${pendingCount === 1 ? '' : 's'} awaiting client sign-off`,
      href: '/dashboard/projects', sublabel: 'Sent to clients, nothing signed yet', tone: 'info',
    })
  }

  // One merged, time-ordered activity stream instead of two separate
  // "recent tickets" / "recent projects" lists.
  type ActivityItem = { key: string; kind: 'ticket' | 'project'; title: string; sublabel: string; date: string; href: string; status: string }
  const activity: ActivityItem[] = [
    ...allTickets.slice(0, 8).map(t => ({
      key: `ticket-${t.id}`, kind: 'ticket' as const, title: t.title,
      sublabel: (t.clients as any)?.name ?? '', date: t.updated_at, href: `/dashboard/tickets/${t.id}`, status: t.status,
    })),
    ...(projects ?? []).map(p => ({
      key: `project-${p.id}`, kind: 'project' as const, title: p.name,
      sublabel: (p.clients as any)?.name ?? '', date: p.updated_at, href: `/dashboard/projects/${p.id}`, status: p.status,
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8)

  const toneStyle = {
    danger:  { bg: 'var(--danger-bg)', color: 'var(--danger-text)' },
    warning: { bg: 'var(--warning-bg)', color: 'var(--warning-text)' },
    info:    { bg: 'var(--info-bg)', color: 'var(--info-text)' },
  }

  return (
    <div>
      <div className="animate-in" style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
          {greeting()}{me?.name ? `, ${me.name.split(' ')[0]}` : ''}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Needs your attention */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
          Needs your attention
        </div>

        {attention.length === 0 ? (
          <div className="animate-in" style={{
            display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 18px',
            background: 'var(--success-bg)', borderRadius: '10px', color: 'var(--success-text)',
          }}>
            <PartyPopper size={18} />
            <span style={{ fontSize: '13px', fontWeight: 500 }}>Nothing urgent, unassigned, or waiting on a signature. You're caught up.</span>
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
                    {item.tone === 'danger' ? <AlertTriangle size={14} /> : item.tone === 'warning' ? <UserX size={14} /> : <FileSignature size={14} />}
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
