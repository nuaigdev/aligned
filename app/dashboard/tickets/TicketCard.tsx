'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { formatTicketRef, TICKET_PRIORITY_COLOR, formatRelative } from '@/lib/utils'
import { getInitials } from '@/lib/utils'
import { MessageSquare } from 'lucide-react'
import type { Ticket, TeamMember } from '@/types'

export interface BoardTicket extends Ticket {
  client_name?: string
  project_name?: string | null
  assignee_members?: TeamMember[]
}

export default function TicketCard({
  ticket,
  draggable,
  onDragStart,
}: {
  ticket: BoardTicket
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
}) {
  return (
    <div draggable={draggable} onDragStart={onDragStart} style={{ cursor: draggable ? 'grab' : 'pointer' }}>
      <motion.div
        layoutId={`ticket-${ticket.id}`}
        layout
        whileHover={{ y: -1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        style={{
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border-default)',
          borderRadius: '8px',
          padding: '10px 12px',
        }}
      >
      <Link href={`/dashboard/tickets/${ticket.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '5px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: TICKET_PRIORITY_COLOR[ticket.priority], marginTop: '5px', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>{ticket.title}</span>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
          {formatTicketRef(ticket.ref_number)} · {ticket.client_name}
          {ticket.blocked_on && (
            <span style={{ color: 'var(--warning-text)' }}> · Waiting on {ticket.blocked_on === 'client' ? 'client' : 'team'}</span>
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
