import Link from 'next/link'
import { getSessionClient } from '@/lib/portal/session-guard'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { TICKET_STATUS_CONFIG } from '@/lib/utils'
import { Plus } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PortalHubPage() {
  const client = await getSessionClient()
  const supabase = createServiceRoleClient()

  // Projects are paused while the product focuses on Ticketing — the
  // "Your projects" section (and its query) is removed here; see
  // app/portal/(app)/projects/[projectId]/layout.tsx for the drill-down
  // redirect. Nothing about the underlying projects data changed.
  const { data: tickets } = await supabase
    .from('tickets')
    .select('id, status')
    .eq('client_id', client.id)
    .eq('ticket_type', 'client')

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>Your tickets</div>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
              {openTotal > 0 ? `${openTotal} ticket${openTotal === 1 ? '' : 's'} still being worked on` : "Nothing open — you're all caught up"}
            </div>
          </div>
          <Link
            href="/portal/tickets/new"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '13px', fontWeight: 500, color: '#fff', background: 'var(--brand-600)',
              padding: '8px 14px', borderRadius: '8px', textDecoration: 'none',
            }}
          >
            <Plus size={14} /> New ticket
          </Link>
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
    </div>
  )
}
