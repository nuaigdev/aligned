'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { X, Plus, Pencil, Check } from 'lucide-react'
import { updateTicket, setTicketAssignees } from '@/lib/tickets/team-actions'
import { getInitials, formatDate, TICKET_STATUS_CONFIG, TICKET_PRIORITY_COLOR, formatTicketRef } from '@/lib/utils'
import { TICKET_LANES, TICKET_STATUS_LABELS, TICKET_PRIORITY_LABELS } from '@/types'
import type { Ticket, TeamMember, TicketPriority, TicketStatus } from '@/types'

const CATEGORY_OPTIONS = ['general', 'bug', 'feature_request', 'question', 'billing']

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px', border: '0.5px solid var(--border-medium)', borderRadius: '7px',
  fontSize: '13px', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', background: 'var(--bg-primary)',
}

export default function TicketDetail({
  ticket,
  candidatePool,
  initialAssigneeIds,
}: {
  ticket: Ticket
  candidatePool: TeamMember[]
  initialAssigneeIds: string[]
}) {
  const [status, setStatus] = useState<TicketStatus>(ticket.status)
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority)
  const [blockedOn, setBlockedOn] = useState(ticket.blocked_on)
  const [assigneeIds, setAssigneeIds] = useState<string[]>(initialAssigneeIds)
  const [showPicker, setShowPicker] = useState(false)

  const [title, setTitle] = useState(ticket.title)
  const [description, setDescription] = useState(ticket.description ?? '')
  const [category, setCategory] = useState(ticket.category)
  const [dueDate, setDueDate] = useState(ticket.due_date ?? '')
  const [editingDetails, setEditingDetails] = useState(false)
  const [draft, setDraft] = useState({ title, description, category, dueDate })
  const [savingDetails, setSavingDetails] = useState(false)

  async function patch(fields: Parameters<typeof updateTicket>[1]) {
    const result = await updateTicket(ticket.id, fields)
    if ('error' in result) toast.error(result.error)
    return !('error' in result)
  }

  async function handleStatusChange(next: TicketStatus) {
    const prev = status
    setStatus(next)
    if (!(await patch({ status: next }))) setStatus(prev)
  }

  async function handlePriorityChange(next: TicketPriority) {
    const prev = priority
    setPriority(next)
    if (!(await patch({ priority: next }))) setPriority(prev)
  }

  async function handleBlockedOnChange(next: 'client' | 'team' | null) {
    const prev = blockedOn
    setBlockedOn(next)
    if (!(await patch({ blocked_on: next }))) setBlockedOn(prev)
  }

  async function toggleAssignee(id: string) {
    const prev = assigneeIds
    const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    setAssigneeIds(next)
    const result = await setTicketAssignees(ticket.id, next)
    if ('error' in result) {
      setAssigneeIds(prev)
      toast.error(result.error)
    }
  }

  function startEditingDetails() {
    setDraft({ title, description, category, dueDate })
    setEditingDetails(true)
  }

  async function saveDetails() {
    if (!draft.title.trim()) {
      toast.error('Title cannot be empty')
      return
    }
    setSavingDetails(true)
    const ok = await patch({
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      category: draft.category,
      due_date: draft.dueDate || null,
    })
    setSavingDetails(false)
    if (ok) {
      setTitle(draft.title.trim())
      setDescription(draft.description.trim())
      setCategory(draft.category)
      setDueDate(draft.dueDate)
      setEditingDetails(false)
      toast.success('Ticket updated')
    }
  }

  const assignedMembers = candidatePool.filter(m => assigneeIds.includes(m.id))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>{formatTicketRef(ticket.ref_number)}</div>
          {!editingDetails && (
            <button onClick={startEditingDetails} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-600)', fontSize: '12px', flexShrink: 0 }}>
              <Pencil size={12} /> Edit
            </button>
          )}
        </div>

        {editingDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Title</label>
              <input autoFocus value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Description</label>
              <textarea value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} rows={4} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Category</label>
                <select value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} style={inputStyle}>
                  {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Due date</label>
                <input type="date" value={draft.dueDate} onChange={e => setDraft(d => ({ ...d, dueDate: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingDetails(false)} disabled={savingDetails} style={{ padding: '7px 14px', borderRadius: '7px', border: '0.5px solid var(--border-medium)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={saveDetails} disabled={savingDetails} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '7px', border: 'none', background: 'var(--brand-600)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', opacity: savingDetails ? 0.7 : 1 }}>
                <Check size={13} /> {savingDetails ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 8px' }}>{title}</h1>
            {description && (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{description}</p>
            )}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
              <span style={{ textTransform: 'capitalize' }}>{category.replace('_', ' ')}</span>
              <span>·</span>
              <span>Raised by {ticket.created_by_client_name ?? 'a team member'}</span>
              <span>·</span>
              <span>{formatDate(ticket.created_at)}</span>
              {dueDate && <><span>·</span><span>Due {formatDate(dueDate)}</span></>}
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>Status</div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {TICKET_LANES.map(s => (
              <button key={s} onClick={() => handleStatusChange(s)} style={{
                fontSize: '11px', padding: '4px 10px', borderRadius: '10px', fontWeight: 500, cursor: 'pointer',
                border: status === s ? `1px solid ${TICKET_STATUS_CONFIG[s].color}` : '0.5px solid var(--border-default)',
                background: status === s ? TICKET_STATUS_CONFIG[s].bg : 'transparent',
                color: status === s ? TICKET_STATUS_CONFIG[s].color : 'var(--text-tertiary)',
              }}>
                {TICKET_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '14px 16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>Priority</div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {(Object.keys(TICKET_PRIORITY_LABELS) as TicketPriority[]).map(p => (
              <button key={p} onClick={() => handlePriorityChange(p)} style={{
                fontSize: '11px', padding: '4px 10px', borderRadius: '10px', fontWeight: 500, cursor: 'pointer',
                border: priority === p ? `1px solid ${TICKET_PRIORITY_COLOR[p]}` : '0.5px solid var(--border-default)',
                background: priority === p ? `${TICKET_PRIORITY_COLOR[p]}18` : 'transparent',
                color: priority === p ? TICKET_PRIORITY_COLOR[p] : 'var(--text-tertiary)',
              }}>
                {TICKET_PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '14px 16px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>Waiting on</div>
        <div style={{ display: 'flex', gap: '5px' }}>
          {([null, 'team', 'client'] as const).map(v => (
            <button key={v ?? 'none'} onClick={() => handleBlockedOnChange(v)} style={{
              fontSize: '11px', padding: '4px 10px', borderRadius: '10px', fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize',
              border: blockedOn === v ? '1px solid var(--brand-600)' : '0.5px solid var(--border-default)',
              background: blockedOn === v ? 'var(--brand-50)' : 'transparent',
              color: blockedOn === v ? 'var(--brand-600)' : 'var(--text-tertiary)',
            }}>
              {v ?? 'Neither'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Assignees</span>
          <button onClick={() => setShowPicker(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-600)', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px' }}>
            <Plus size={12} /> Edit
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {assignedMembers.length === 0 && <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Unassigned</span>}
          {assignedMembers.map(m => (
            <span key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: '4px 8px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
              {m.name}
            </span>
          ))}
        </div>

        {showPicker && (
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
    </div>
  )
}
