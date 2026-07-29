'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { LayoutGrid, List as ListIcon, Search, Plus, Inbox, ArrowUp, ArrowDown, ChevronDown, Lock, Building2 } from 'lucide-react'
import { updateTicket, setTicketAssignees, findTicketByRef } from '@/lib/tickets/team-actions'
import { formatTicketRef, ticketClientCode, formatRelative, getInitials, TICKET_STATUS_CONFIG, TICKET_PRIORITY_COLOR } from '@/lib/utils'
import { TICKET_LANES, TICKET_PRIORITY_LABELS } from '@/types'
import type { TicketStatus, TicketPriority, TeamMember } from '@/types'
import TicketCard, { type BoardTicket } from './TicketCard'
import NewTicketModal from './NewTicketModal'

export interface SelectableProject {
  id: string
  name: string
  client_id: string
  client_name: string
}

type Filter = 'all' | 'mine' | 'unassigned'
type View = 'board' | 'list'
type GroupBy = 'status' | 'priority' | 'assignee'
type SortKey = 'title' | 'client' | 'status' | 'priority' | 'updated'

const GROUP_LABELS: Record<GroupBy, string> = { status: 'Status', priority: 'Priority', assignee: 'Assignee' }
const PRIORITY_ORDER: TicketPriority[] = ['urgent', 'high', 'medium', 'low']
const PRIORITY_RANK: Record<TicketPriority, number> = { urgent: 3, high: 2, medium: 1, low: 0 }
const STATUS_RANK: Record<TicketStatus, number> = { open: 0, in_progress: 1, resolved: 2, closed: 3 }

export default function TicketsBoard({
  initialTickets,
  teamMembers,
  projects,
  projectMemberIds,
  currentTeamMemberId,
  defaultProjectId,
}: {
  initialTickets: BoardTicket[]
  teamMembers: TeamMember[]
  projects: SelectableProject[]
  projectMemberIds: Record<string, string[]>
  currentTeamMemberId: string
  defaultProjectId?: string
}) {
  const router = useRouter()
  const [tickets, setTickets] = useState(initialTickets)
  const [view, setView] = useState<View>('board')
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [groupMenuOpen, setGroupMenuOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [dragOverLane, setDragOverLane] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('updated')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [searchingGlobally, setSearchingGlobally] = useState(false)

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

  // The default list only shows tickets from the caller's own projects
  // (server-scoped in page.tsx) — any ticket is still viewable by number,
  // it just won't be in this loaded set, hence a server round-trip here
  // rather than a client-side filter.
  const looksLikeTicketNumber = /\d/.test(search)
  async function handleGlobalSearch() {
    setSearchingGlobally(true)
    const result = await findTicketByRef(search)
    setSearchingGlobally(false)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    router.push(`/dashboard/tickets/${result.id}`)
  }

  async function applyFieldChange(ticketId: string, field: 'status' | 'priority', value: string) {
    const prev = tickets
    setTickets(cur => cur.map(t => (t.id === ticketId ? { ...t, [field]: value } : t)))
    const result = await updateTicket(ticketId, { [field]: value } as any)
    if ('error' in result) {
      setTickets(prev)
      toast.error(result.error)
      return
    }
    const label = field === 'priority' ? TICKET_PRIORITY_LABELS[value as TicketPriority] : TICKET_STATUS_CONFIG[value as TicketStatus].label
    toast.success(`${field === 'priority' ? 'Priority' : 'Status'} set to ${label}`)
  }

  async function applyAssigneeChange(ticketId: string, memberIds: string[]) {
    const prev = tickets
    const members = teamMembers.filter(m => memberIds.includes(m.id))
    setTickets(cur => cur.map(t => (t.id === ticketId ? { ...t, assignee_members: members } : t)))
    const result = await setTicketAssignees(ticketId, memberIds)
    if ('error' in result) {
      setTickets(prev)
      toast.error(result.error)
      return
    }
    toast.success(members.length > 0 ? `Assigned to ${members.map(m => m.name).join(', ')}` : 'Unassigned')
  }

  function handleDrop(e: React.DragEvent, laneKey: string) {
    e.preventDefault()
    setDragOverLane(null)
    const ticketId = e.dataTransfer.getData('text/ticket-id')
    if (!ticketId) return
    const ticket = tickets.find(t => t.id === ticketId)
    if (!ticket) return

    if (groupBy === 'status') {
      if (ticket.status !== laneKey) applyFieldChange(ticketId, 'status', laneKey)
    } else if (groupBy === 'priority') {
      if (ticket.priority !== laneKey) applyFieldChange(ticketId, 'priority', laneKey)
    } else {
      const current = (ticket.assignee_members ?? []).map(m => m.id)
      if (laneKey === 'unassigned') {
        if (current.length > 0) applyAssigneeChange(ticketId, [])
      } else if (!current.includes(laneKey)) {
        applyAssigneeChange(ticketId, [laneKey])
      }
    }
  }

  const lanes = useMemo(() => {
    if (groupBy === 'priority') {
      return PRIORITY_ORDER.map(p => ({
        key: p as string,
        label: TICKET_PRIORITY_LABELS[p],
        color: TICKET_PRIORITY_COLOR[p],
        bg: `${TICKET_PRIORITY_COLOR[p]}18`,
        match: (t: BoardTicket) => t.priority === p,
      }))
    }
    if (groupBy === 'assignee') {
      const defs = teamMembers.map(m => ({
        key: m.id,
        label: m.name,
        color: 'var(--brand-800)',
        bg: 'var(--brand-50)',
        match: (t: BoardTicket) => (t.assignee_members ?? []).some(a => a.id === m.id),
      }))
      defs.push({
        key: 'unassigned',
        label: 'Unassigned',
        color: 'var(--text-tertiary)',
        bg: 'var(--bg-tertiary)',
        match: (t: BoardTicket) => (t.assignee_members ?? []).length === 0,
      })
      return defs
    }
    return TICKET_LANES.map(lane => {
      const cfg = TICKET_STATUS_CONFIG[lane]
      return { key: lane as string, label: cfg.label, color: cfg.color, bg: cfg.bg, match: (t: BoardTicket) => t.status === lane }
    })
  }, [groupBy, teamMembers])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'title': cmp = a.title.localeCompare(b.title); break
        case 'client': cmp = (a.client_name ?? '').localeCompare(b.client_name ?? ''); break
        case 'status': cmp = STATUS_RANK[a.status] - STATUS_RANK[b.status]; break
        case 'priority': cmp = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]; break
        case 'updated': cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [filtered, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir(key === 'title' || key === 'client' ? 'asc' : 'desc') }
  }

  function SortHeader({ label, sortKeyValue, flex }: { label: string; sortKeyValue: SortKey; flex: string }) {
    const active = sortKey === sortKeyValue
    return (
      <button
        onClick={() => toggleSort(sortKeyValue)}
        style={{
          flex, display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '11px', fontWeight: 500, color: active ? 'var(--text-primary)' : 'var(--text-tertiary)', textAlign: 'left', padding: 0,
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}
      >
        {label} {active && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
      </button>
    )
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
                transition: 'background .12s, color .12s',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, maxWidth: '280px', gap: '3px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
            <Search size={13} color="var(--text-tertiary)" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && looksLikeTicketNumber && filtered.length === 0) handleGlobalSearch() }}
              placeholder="Search tickets, or #number to find any ticket…"
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '12px', color: 'var(--text-primary)' }}
            />
          </div>
          {search.trim() && looksLikeTicketNumber && filtered.length === 0 && (
            <button
              onClick={handleGlobalSearch}
              disabled={searchingGlobally}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-600)', fontSize: '11px', textAlign: 'left', padding: '0 2px' }}
            >
              {searchingGlobally ? 'Searching…' : `Not in your projects — search all tickets for "${search.trim()}" →`}
            </button>
          )}
        </div>

        {view === 'board' && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setGroupMenuOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 11px', borderRadius: '8px',
                border: '0.5px solid var(--border-default)', background: 'var(--bg-primary)', cursor: 'pointer',
                fontSize: '12px', color: 'var(--text-secondary)',
              }}
            >
              Group: <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{GROUP_LABELS[groupBy]}</strong>
              <ChevronDown size={11} style={{ opacity: 0.6 }} />
            </button>
            {groupMenuOpen && (
              <>
                <div onClick={() => setGroupMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.12 }}
                  style={{
                    position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: '140px', zIndex: 50,
                    background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '8px',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.15)', overflow: 'hidden', padding: '4px',
                  }}
                >
                  {(Object.keys(GROUP_LABELS) as GroupBy[]).map(g => (
                    <button
                      key={g}
                      onClick={() => { setGroupBy(g); setGroupMenuOpen(false) }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '7px 9px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                        background: groupBy === g ? 'var(--bg-tertiary)' : 'transparent', fontSize: '12px', color: 'var(--text-primary)',
                      }}
                    >
                      {GROUP_LABELS[g]}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </div>
        )}

        <div style={{ marginLeft: view === 'board' ? 0 : 'auto', display: 'flex', gap: '4px', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '3px' }}>
          <button onClick={() => setView('board')} title="Board" style={{ padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: view === 'board' ? 'var(--bg-primary)' : 'transparent', color: view === 'board' ? 'var(--brand-600)' : 'var(--text-tertiary)', display: 'flex', transition: 'background .12s, color .12s' }}>
            <LayoutGrid size={14} />
          </button>
          <button onClick={() => setView('list')} title="List" style={{ padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: view === 'list' ? 'var(--bg-primary)' : 'transparent', color: view === 'list' ? 'var(--brand-600)' : 'var(--text-tertiary)', display: 'flex', transition: 'background .12s, color .12s' }}>
            <ListIcon size={14} />
          </button>
        </div>

        <button
          onClick={() => setShowNew(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '8px', border: 'none', background: 'var(--brand-600)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
        >
          <Plus size={14} /> New ticket
        </button>
      </div>

      {view === 'board' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px', alignItems: 'start' }}>
          {lanes.map((lane, laneIndex) => {
            const laneTickets = filtered.filter(lane.match)
            return (
              <div
                key={lane.key}
                className="animate-in"
                onDragOver={e => { e.preventDefault(); setDragOverLane(lane.key) }}
                onDragLeave={() => setDragOverLane(cur => (cur === lane.key ? null : cur))}
                onDrop={e => handleDrop(e, lane.key)}
                style={{
                  background: dragOverLane === lane.key ? 'var(--brand-50)' : 'var(--bg-tertiary)',
                  borderRadius: '10px', overflow: 'hidden', minHeight: '140px',
                  transition: 'background .12s',
                  animationDelay: `${laneIndex * 40}ms`,
                }}
              >
                <div style={{ height: '3px', background: lane.color, opacity: 0.55 }} />
                <div style={{ padding: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', padding: '0 2px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lane.label}</span>
                    <span style={{
                      fontSize: '11px', fontWeight: 500, padding: '1px 7px', borderRadius: '8px', flexShrink: 0,
                      background: lane.bg, color: lane.color,
                    }}>
                      {laneTickets.length}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <AnimatePresence initial={false}>
                      {laneTickets.map(ticket => (
                        <TicketCard
                          key={ticket.id}
                          ticket={ticket}
                          draggable
                          onDragStart={e => e.dataTransfer.setData('text/ticket-id', ticket.id)}
                          onPriorityChange={(id, priority) => applyFieldChange(id, 'priority', priority)}
                        />
                      ))}
                    </AnimatePresence>
                    {laneTickets.length === 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 0' }}>
                        <Inbox size={16} strokeWidth={1.5} />
                        <span style={{ fontSize: '11px' }}>No tickets</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', borderBottom: '0.5px solid var(--border-default)', background: 'var(--bg-tertiary)' }}>
            <SortHeader label="Title" sortKeyValue="title" flex="1 1 auto" />
            <SortHeader label="Client" sortKeyValue="client" flex="0 0 140px" />
            <SortHeader label="Status" sortKeyValue="status" flex="0 0 110px" />
            <SortHeader label="Priority" sortKeyValue="priority" flex="0 0 90px" />
            <span style={{ flex: '0 0 90px', fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Assignee</span>
            <SortHeader label="Updated" sortKeyValue="updated" flex="0 0 80px" />
          </div>

          <AnimatePresence initial={false}>
            {sorted.map(ticket => {
              const statusCfg = TICKET_STATUS_CONFIG[ticket.status]
              const priorityColor = TICKET_PRIORITY_COLOR[ticket.priority]
              return (
                <motion.div key={ticket.id} layout>
                  <Link
                    href={`/dashboard/tickets/${ticket.id}`}
                    className="hover-card"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                      borderBottom: '0.5px solid var(--border-default)', textDecoration: 'none', color: 'inherit',
                    }}
                  >
                    <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ticket.title}
                        </div>
                        {ticket.ticket_type === 'internal' ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', fontWeight: 500, flexShrink: 0 }}>
                            <Lock size={9} /> Internal
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: 'var(--brand-50)', color: 'var(--brand-600)', fontWeight: 500, flexShrink: 0 }}>
                            <Building2 size={9} /> Client
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '1px', fontFamily: 'var(--font-geist-mono, monospace)' }}>
                        {formatTicketRef(ticket.ref_number, ticket.client_slug && ticketClientCode(ticket.client_slug))}
                      </div>
                    </div>
                    <div style={{ flex: '0 0 140px', fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ticket.client_name}
                    </div>
                    <div style={{ flex: '0 0 110px' }}>
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '8px', fontWeight: 500, background: statusCfg.bg, color: statusCfg.color }}>
                        {statusCfg.label}
                      </span>
                    </div>
                    <div style={{ flex: '0 0 90px' }}>
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '8px', fontWeight: 500, background: `${priorityColor}18`, color: priorityColor }}>
                        {TICKET_PRIORITY_LABELS[ticket.priority]}
                      </span>
                    </div>
                    <div style={{ flex: '0 0 90px', display: 'flex' }}>
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
                      {(ticket.assignee_members ?? []).length === 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>—</span>
                      )}
                    </div>
                    <div style={{ flex: '0 0 80px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      {formatRelative(ticket.updated_at)}
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {sorted.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '48px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <Inbox size={20} strokeWidth={1.5} />
              <span style={{ fontSize: '13px' }}>No tickets match this view</span>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showNew && (
          <NewTicketModal
            onClose={() => setShowNew(false)}
            projects={projects}
            projectMemberIds={projectMemberIds}
            teamMembers={teamMembers}
            defaultProjectId={defaultProjectId}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
