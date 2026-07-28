'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { Plus, X } from 'lucide-react'
import { updateTicket, setTicketAssignees } from '@/lib/tickets/team-actions'
import { getInitials, formatDate, TICKET_STATUS_CONFIG, TICKET_PRIORITY_COLOR } from '@/lib/utils'
import { TICKET_LANES, TICKET_STATUS_LABELS, TICKET_PRIORITY_LABELS } from '@/types'
import type { Ticket, TeamMember, TicketPriority, TicketStatus } from '@/types'
import { QuickDropdown, DropdownItem, PillTrigger, Dot } from '@/components/dashboard/QuickDropdown'

const CATEGORY_OPTIONS = ['general', 'bug', 'feature_request', 'question', 'billing']

/**
 * The docked "properties" sidebar — status/priority/category/due
 * date/blocked-on/assignees all live here, matching how Linear/Jira
 * separate "what this issue IS" (main column: title, description,
 * conversation) from "the fields on it" (this panel). Each row is its
 * own compact control rather than a full-width card per field.
 */
export default function TicketPropertiesPanel({
  ticket,
  candidatePool,
  initialAssigneeIds,
  clientProjects,
}: {
  ticket: Ticket
  candidatePool: TeamMember[]
  initialAssigneeIds: string[]
  clientProjects: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const [status, setStatus] = useState<TicketStatus>(ticket.status)
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority)
  const [category, setCategory] = useState(ticket.category)
  const [projectId, setProjectId] = useState(ticket.project_id)
  const [dueDate, setDueDate] = useState(ticket.due_date ?? '')
  const [blockedOn, setBlockedOn] = useState(ticket.blocked_on)
  const [assigneeIds, setAssigneeIds] = useState<string[]>(initialAssigneeIds)
  const [openSection, setOpenSection] = useState<string | null>(null)

  async function patch(fields: Parameters<typeof updateTicket>[1], successMessage: string) {
    const result = await updateTicket(ticket.id, fields)
    if ('error' in result) {
      toast.error(result.error)
      return false
    }
    toast.success(successMessage)
    return true
  }

  async function handleStatusChange(next: TicketStatus) {
    const prev = status
    setStatus(next)
    setOpenSection(null)
    if (!(await patch({ status: next }, `Status set to ${TICKET_STATUS_LABELS[next]}`))) setStatus(prev)
  }

  async function handlePriorityChange(next: TicketPriority) {
    const prev = priority
    setPriority(next)
    setOpenSection(null)
    if (!(await patch({ priority: next }, `Priority set to ${TICKET_PRIORITY_LABELS[next]}`))) setPriority(prev)
  }

  async function handleCategoryChange(next: string) {
    const prev = category
    setCategory(next)
    setOpenSection(null)
    if (!(await patch({ category: next }, `Category set to ${next.replace('_', ' ')}`))) setCategory(prev)
  }

  async function handleProjectChange(next: string | null) {
    const prev = projectId
    setProjectId(next)
    setOpenSection(null)
    const projectName = clientProjects.find(p => p.id === next)?.name
    const ok = await patch({ project_id: next }, next ? `Moved to ${projectName ?? 'project'}` : 'Removed from project')
    if (!ok) setProjectId(prev)
    else router.refresh() // the breadcrumb/ref line above is server-rendered
  }

  async function handleDueDateChange(next: string) {
    const prev = dueDate
    setDueDate(next)
    if (!(await patch({ due_date: next || null }, next ? 'Due date updated' : 'Due date cleared'))) setDueDate(prev)
  }

  async function handleBlockedOnChange(next: 'client' | 'team' | null) {
    const prev = blockedOn
    setBlockedOn(next)
    setOpenSection(null)
    if (!(await patch({ blocked_on: next }, next ? `Waiting on ${next}` : 'No longer blocked'))) setBlockedOn(prev)
  }

  async function toggleAssignee(id: string) {
    const prev = assigneeIds
    const adding = !prev.includes(id)
    const next = adding ? [...prev, id] : prev.filter(x => x !== id)
    const member = candidatePool.find(m => m.id === id)
    setAssigneeIds(next)
    const result = await setTicketAssignees(ticket.id, next)
    if ('error' in result) {
      setAssigneeIds(prev)
      toast.error(result.error)
      return
    }
    toast.success(adding ? `${member?.name ?? 'Assignee'} added` : `${member?.name ?? 'Assignee'} removed`)
  }

  const assignedMembers = candidatePool.filter(m => assigneeIds.includes(m.id))
  const statusCfg = TICKET_STATUS_CONFIG[status]

  return (
    <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', overflow: 'hidden' }}>
      <PropertyRow label="Status">
        <QuickDropdown
          open={openSection === 'status'}
          onToggle={() => setOpenSection(o => (o === 'status' ? null : 'status'))}
          trigger={
            <PillTrigger color={statusCfg.color} bg={statusCfg.bg} label={TICKET_STATUS_LABELS[status]} />
          }
        >
          {TICKET_LANES.map(s => (
            <DropdownItem key={s} onClick={() => handleStatusChange(s)} active={s === status}>
              <Dot color={TICKET_STATUS_CONFIG[s].color} /> {TICKET_STATUS_LABELS[s]}
            </DropdownItem>
          ))}
        </QuickDropdown>
      </PropertyRow>

      <PropertyRow label="Priority">
        <QuickDropdown
          open={openSection === 'priority'}
          onToggle={() => setOpenSection(o => (o === 'priority' ? null : 'priority'))}
          trigger={<PillTrigger color={TICKET_PRIORITY_COLOR[priority]} bg={`${TICKET_PRIORITY_COLOR[priority]}18`} label={TICKET_PRIORITY_LABELS[priority]} />}
        >
          {(Object.keys(TICKET_PRIORITY_LABELS) as TicketPriority[]).map(p => (
            <DropdownItem key={p} onClick={() => handlePriorityChange(p)} active={p === priority}>
              <Dot color={TICKET_PRIORITY_COLOR[p]} /> {TICKET_PRIORITY_LABELS[p]}
            </DropdownItem>
          ))}
        </QuickDropdown>
      </PropertyRow>

      <PropertyRow label="Category">
        <QuickDropdown
          open={openSection === 'category'}
          onToggle={() => setOpenSection(o => (o === 'category' ? null : 'category'))}
          trigger={<PillTrigger color="var(--text-secondary)" bg="var(--bg-tertiary)" label={category.replace('_', ' ')} />}
        >
          {CATEGORY_OPTIONS.map(c => (
            <DropdownItem key={c} onClick={() => handleCategoryChange(c)} active={c === category}>
              {c.replace('_', ' ')}
            </DropdownItem>
          ))}
        </QuickDropdown>
      </PropertyRow>

      <PropertyRow label="Project">
        <QuickDropdown
          open={openSection === 'project'}
          onToggle={() => setOpenSection(o => (o === 'project' ? null : 'project'))}
          trigger={
            <PillTrigger
              color={projectId ? 'var(--brand-600)' : 'var(--text-tertiary)'}
              bg={projectId ? 'var(--brand-50)' : 'var(--bg-tertiary)'}
              label={projectId ? (clientProjects.find(p => p.id === projectId)?.name ?? 'Unknown') : 'None'}
            />
          }
        >
          <DropdownItem onClick={() => handleProjectChange(null)} active={!projectId}>
            No project
          </DropdownItem>
          {clientProjects.map(p => (
            <DropdownItem key={p.id} onClick={() => handleProjectChange(p.id)} active={p.id === projectId}>
              {p.name}
            </DropdownItem>
          ))}
          {clientProjects.length === 0 && (
            <div style={{ padding: '7px 9px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
              This client has no projects yet.
            </div>
          )}
        </QuickDropdown>
      </PropertyRow>

      <PropertyRow label="Waiting on">
        <QuickDropdown
          open={openSection === 'blocked'}
          onToggle={() => setOpenSection(o => (o === 'blocked' ? null : 'blocked'))}
          trigger={<PillTrigger color={blockedOn ? 'var(--brand-600)' : 'var(--text-tertiary)'} bg={blockedOn ? 'var(--brand-50)' : 'var(--bg-tertiary)'} label={blockedOn ? (blockedOn === 'client' ? 'Client' : 'Team') : 'Neither'} />}
        >
          {([null, 'team', 'client'] as const).map(v => (
            <DropdownItem key={v ?? 'none'} onClick={() => handleBlockedOnChange(v)} active={v === blockedOn}>
              {v ?? 'Neither'}
            </DropdownItem>
          ))}
        </QuickDropdown>
      </PropertyRow>

      <PropertyRow label="Due date">
        <input
          type="date"
          value={dueDate}
          onChange={e => handleDueDateChange(e.target.value)}
          style={{
            fontSize: '12px', padding: '5px 8px', borderRadius: '6px', border: '0.5px solid var(--border-default)',
            background: 'var(--bg-tertiary)', color: dueDate ? 'var(--text-primary)' : 'var(--text-tertiary)', outline: 'none',
          }}
        />
      </PropertyRow>

      <div style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Assignees</span>
          <button onClick={() => setOpenSection(o => (o === 'assignees' ? null : 'assignees'))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-600)', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px' }}>
            <Plus size={11} /> Edit
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {assignedMembers.length === 0 && <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Unassigned</span>}
          {assignedMembers.map(m => (
            <span key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: '4px 8px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
              <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--brand-50)', color: 'var(--brand-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 600 }}>
                {getInitials(m.name)}
              </span>
              {m.name}
            </span>
          ))}
        </div>

        {openSection === 'assignees' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ marginTop: '10px', borderTop: '0.5px solid var(--border-default)', paddingTop: '10px' }}>
            {candidatePool.map(m => {
              const selected = assigneeIds.includes(m.id)
              return (
                <button key={m.id} onClick={() => toggleAssignee(m.id)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px',
                  background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--brand-50)', color: 'var(--brand-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 500 }}>
                    {getInitials(m.name)}
                  </div>
                  <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-primary)' }}>{m.name}</span>
                  {selected && <X size={12} color="var(--text-tertiary)" />}
                </button>
              )
            })}
            {candidatePool.length === 0 && (
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Assign a Manager to this client first.</p>
            )}
          </motion.div>
        )}
      </div>

      <div style={{ padding: '12px 14px', borderTop: '0.5px solid var(--border-default)' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Raised</div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          By {ticket.created_by_client_name ?? 'a team member'} · {formatDate(ticket.created_at)}
        </div>
      </div>
    </div>
  )
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '0.5px solid var(--border-default)', position: 'relative' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</span>
      {children}
    </div>
  )
}
