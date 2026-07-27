'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { LayoutGrid, List as ListIcon, Search } from 'lucide-react'
import { updateTicket } from '@/lib/tickets/team-actions'
import { TICKET_LANES, TICKET_STATUS_LABELS } from '@/types'
import type { TicketStatus, TeamMember, Client, Project } from '@/types'
import TicketCard, { type BoardTicket } from './TicketCard'
import NewTicketModal from './NewTicketModal'

type Filter = 'all' | 'mine' | 'unassigned'
type View = 'board' | 'list'

export default function TicketsBoard({
  initialTickets,
  teamMembers,
  clients,
  projects,
  currentTeamMemberId,
}: {
  initialTickets: BoardTicket[]
  teamMembers: TeamMember[]
  clients: Client[]
  projects: Project[]
  currentTeamMemberId: string
}) {
  const [tickets, setTickets] = useState(initialTickets)
  const [view, setView] = useState<View>('board')
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [dragOverLane, setDragOverLane] = useState<TicketStatus | null>(null)

  const filtered = useMemo(() => {
    return tickets.filter(t => {
      if (filter === 'mine' && !(t.assignee_members ?? []).some(m => m.id === currentTeamMemberId)) return false
      if (filter === 'unassigned' && (t.assignee_members ?? []).length > 0) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!t.title.toLowerCase().includes(q) && !(t.client_name ?? '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [tickets, filter, search, currentTeamMemberId])

  async function moveTicket(ticketId: string, status: TicketStatus) {
    const prev = tickets
    setTickets(cur => cur.map(t => (t.id === ticketId ? { ...t, status } : t)))

    const result = await updateTicket(ticketId, { status })
    if ('error' in result) {
      setTickets(prev)
      toast.error(result.error)
    }
  }

  function handleDrop(e: React.DragEvent, status: TicketStatus) {
    e.preventDefault()
    setDragOverLane(null)
    const ticketId = e.dataTransfer.getData('text/ticket-id')
    if (!ticketId) return
    const ticket = tickets.find(t => t.id === ticketId)
    if (ticket && ticket.status !== status) moveTicket(ticketId, status)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '3px' }}>
          {(['all', 'mine', 'unassigned'] as Filter[]).map(f => (
            <button
              key={f} onClick={() => setFilter(f)}
              style={{
                padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', border: 'none',
                background: filter === f ? 'var(--bg-primary)' : 'transparent',
                color: filter === f ? 'var(--text-primary)' : 'var(--text-tertiary)',
                textTransform: 'capitalize',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, maxWidth: '280px', padding: '6px 10px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
          <Search size={13} color="var(--text-tertiary)" />
          <input
            value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tickets…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '12px', color: 'var(--text-primary)' }}
          />
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '3px' }}>
          <button onClick={() => setView('board')} title="Board" style={{ padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: view === 'board' ? 'var(--bg-primary)' : 'transparent', color: view === 'board' ? '#534AB7' : 'var(--text-tertiary)', display: 'flex' }}>
            <LayoutGrid size={14} />
          </button>
          <button onClick={() => setView('list')} title="List" style={{ padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: view === 'list' ? 'var(--bg-primary)' : 'transparent', color: view === 'list' ? '#534AB7' : 'var(--text-tertiary)', display: 'flex' }}>
            <ListIcon size={14} />
          </button>
        </div>

        <button
          onClick={() => setShowNew(true)}
          style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#534AB7', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
        >
          + New ticket
        </button>
      </div>

      {view === 'board' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', alignItems: 'start' }}>
          {TICKET_LANES.map(lane => {
            const laneTickets = filtered.filter(t => t.status === lane)
            return (
              <div
                key={lane}
                onDragOver={e => { e.preventDefault(); setDragOverLane(lane) }}
                onDragLeave={() => setDragOverLane(cur => (cur === lane ? null : cur))}
                onDrop={e => handleDrop(e, lane)}
                style={{
                  background: dragOverLane === lane ? 'var(--brand-50)' : 'var(--bg-tertiary)',
                  borderRadius: '10px', padding: '10px', minHeight: '120px',
                  transition: 'background .12s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', padding: '0 2px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>{TICKET_STATUS_LABELS[lane]}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{laneTickets.length}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <AnimatePresence initial={false}>
                    {laneTickets.map(ticket => (
                      <TicketCard
                        key={ticket.id}
                        ticket={ticket}
                        draggable
                        onDragStart={e => e.dataTransfer.setData('text/ticket-id', ticket.id)}
                      />
                    ))}
                  </AnimatePresence>
                  {laneTickets.length === 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '16px 0' }}>No tickets</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <AnimatePresence initial={false}>
            {filtered.map(ticket => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div style={{ padding: '48px', textAlign: 'center', fontSize: '13px', color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', borderRadius: '10px' }}>
              No tickets match this view
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showNew && (
          <NewTicketModal
            onClose={() => setShowNew(false)}
            clients={clients}
            projects={projects}
            teamMembers={teamMembers}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
