'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { formatTicketRef, ticketClientCode, TICKET_PRIORITY_COLOR, formatRelative, getInitials } from '@/lib/utils'
import { MessageSquare, CalendarClock, Lock, Building2 } from 'lucide-react'
import { QuickDropdown, DropdownItem, PillTrigger, Dot } from '@/components/dashboard/QuickDropdown'
import { TICKET_PRIORITY_LABELS } from '@/types'
import type { Ticket, TeamMember, TicketPriority } from '@/types'

export interface BoardTicket extends Ticket {
  client_name?: string
  client_slug?: string
  project_name?: string | null
  assignee_members?: TeamMember[]
}

const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Bug',
  feature_request: 'Feature',
  question: 'Question',
  billing: 'Billing',
}

export default function TicketCard({
  ticket,
  draggable,
  onDragStart,
  onPriorityChange,
}: {
  ticket: BoardTicket
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onPriorityChange?: (ticketId: string, priority: TicketPriority) => void
}) {
  const [priorityOpen, setPriorityOpen] = useState(false)

  const isOverdue = !!ticket.due_date
    && !['resolved', 'closed'].includes(ticket.status)
    && new Date(ticket.due_date) < new Date(new Date().toDateString())

  const categoryLabel = CATEGORY_LABELS[ticket.category]
  const priorityColor = TICKET_PRIORITY_COLOR[ticket.priority]

  return (
    <div draggable={draggable} onDragStart={onDragStart} style={{ cursor: draggable ? 'grab' : 'pointer' }}>
      <motion.div
        layoutId={`ticket-${ticket.id}`}
        layout
        whileHover={{ y: -2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        style={{
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border-default)',
          borderLeft: `3px solid ${priorityColor}`,
          borderRadius: '8px',
          padding: '10px 12px 11px',
        }}
      >
      <Link href={`/dashboard/tickets/${ticket.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: '5px' }}>
          {ticket.title}
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '7px' }}>
          <span style={{ fontFamily: 'var(--font-geist-mono, monospace)' }}>{formatTicketRef(ticket.ref_number, ticket.client_slug && ticketClientCode(ticket.client_slug))}</span>
          {' · '}{ticket.client_name}
        </div>

        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px', alignItems: 'center' }}>
          {ticket.ticket_type === 'internal' ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', padding: '2px 7px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', fontWeight: 500 }}>
              <Lock size={9} /> Internal
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', padding: '2px 7px', borderRadius: '8px', background: 'var(--brand-50)', color: 'var(--brand-600)', fontWeight: 500 }}>
              <Building2 size={9} /> Client
            </span>
          )}
          {onPriorityChange && !ticket.created_by_client_name ? (
            <QuickDropdown
              open={priorityOpen}
              onToggle={() => setPriorityOpen(o => !o)}
              trigger={<PillTrigger color={priorityColor} bg={`${priorityColor}18`} label={TICKET_PRIORITY_LABELS[ticket.priority]} chevron={false} />}
            >
              {(Object.keys(TICKET_PRIORITY_LABELS) as TicketPriority[]).map(p => (
                <DropdownItem
                  key={p}
                  active={p === ticket.priority}
                  onClick={() => { setPriorityOpen(false); onPriorityChange(ticket.id, p) }}
                >
                  <Dot color={TICKET_PRIORITY_COLOR[p]} /> {TICKET_PRIORITY_LABELS[p]}
                </DropdownItem>
              ))}
            </QuickDropdown>
          ) : (
            <span
              title={ticket.created_by_client_name ? "Set by the client — can't be changed by the team" : undefined}
              style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '8px', background: `${priorityColor}18`, color: priorityColor, fontWeight: 500 }}
            >
              {TICKET_PRIORITY_LABELS[ticket.priority]}
            </span>
          )}
          {ticket.internal_priority && (
            <span
              title="Internal priority — for the team's own planning"
              style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 500 }}
            >
              Internal: {TICKET_PRIORITY_LABELS[ticket.internal_priority]}
            </span>
          )}
          {categoryLabel && (
            <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 500 }}>
              {categoryLabel}
            </span>
          )}
          {ticket.blocked_on && (
            <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '8px', background: 'var(--warning-bg)', color: 'var(--warning-text)', fontWeight: 500 }}>
              Waiting on {ticket.blocked_on}
            </span>
          )}
          {isOverdue && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', padding: '2px 7px', borderRadius: '8px', background: 'var(--danger-bg)', color: 'var(--danger-text)', fontWeight: 500 }}>
              <CalendarClock size={10} /> Overdue
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex' }}>
            {(ticket.assignee_members ?? []).slice(0, 3).map((m, i) => (
              <div
                key={m.id}
                title={m.name}
                style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: 'var(--brand-50)', color: 'var(--brand-800)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '9px', fontWeight: 500,
                  marginLeft: i > 0 ? '-6px' : 0,
                  border: '1.5px solid var(--bg-primary)',
                }}
              >
                {getInitials(m.name)}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
            {(ticket.comment_count ?? 0) > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <MessageSquare size={11} /> {ticket.comment_count}
              </span>
            )}
            <span>{formatRelative(ticket.updated_at)}</span>
          </div>
        </div>
      </Link>
      </motion.div>
    </div>
  )
}
