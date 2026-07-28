'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createBrowserClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { sendMilestoneForSignoff } from '@/lib/milestones/actions'
import type { Milestone, MilestoneType, MilestoneStatus } from '@/types'

const TYPE_CONFIG: Record<MilestoneType, { label: string; bg: string; color: string }> = {
  client_gate:   { label: 'Client gate',    bg: 'var(--brand-50)',   color: 'var(--brand-800)' },
  internal:      { label: 'Internal',       bg: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' },
  informational: { label: 'Informational',  bg: 'var(--info-bg)',    color: 'var(--info-text)' },
}

const STATUS_CONFIG: Record<MilestoneStatus, { label: string; bg: string; color: string }> = {
  not_started:      { label: 'Not started',       bg: 'var(--bg-tertiary)',  color: 'var(--text-tertiary)' },
  in_progress:      { label: 'In progress',       bg: 'var(--info-bg)',      color: 'var(--info-text)' },
  awaiting_signoff: { label: 'Awaiting sign-off', bg: 'var(--warning-bg)',   color: 'var(--warning-text)' },
  completed:        { label: 'Completed',          bg: 'var(--success-bg)',   color: 'var(--success-text)' },
  reopened:         { label: 'Reopened',           bg: 'var(--warning-bg)',   color: 'var(--warning-text)' },
}

const NEXT_STATUSES: Record<MilestoneStatus, MilestoneStatus[]> = {
  not_started:      ['in_progress'],
  in_progress:      ['awaiting_signoff', 'completed'],
  awaiting_signoff: ['in_progress', 'completed'],
  completed:        ['reopened'],
  reopened:         ['in_progress'],
}

const SEND_ELIGIBLE: MilestoneStatus[] = ['not_started', 'in_progress', 'reopened']

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px',
  border: '0.5px solid var(--border-medium)', borderRadius: '7px',
  fontSize: '13px', color: 'var(--text-primary)', outline: 'none',
  boxSizing: 'border-box', background: 'var(--bg-primary)',
}

const emptyForm = { title: '', type: 'internal' as MilestoneType, phase: '', due_date: '', description: '', percentage: '' }

export default function MilestonesPanel({
  projectId,
  initialMilestones,
  canManage,
}: {
  projectId: string
  initialMilestones: Milestone[]
  canManage: boolean
}) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [addError, setAddError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)

  const [editModal, setEditModal] = useState<Milestone | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const totalAssigned = initialMilestones.reduce((sum, m) => sum + (m.percentage ?? 0), 0)
  const remainingForAdd = Math.max(0, 100 - totalAssigned)

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setAddError(null)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    const pct = Number(form.percentage) || 0
    if (pct < 0 || pct > 100) {
      setAddError('Percentage must be between 0 and 100.')
      return
    }
    if (totalAssigned + pct > 100) {
      setAddError(`That would put this project at ${totalAssigned + pct}% — only ${remainingForAdd}% is left to assign.`)
      return
    }

    setSaving(true)
    const { error } = await supabase.from('milestones').insert({
      project_id: projectId,
      title: form.title.trim(),
      type: form.type,
      phase: form.phase.trim() || null,
      due_date: form.due_date || null,
      description: form.description.trim() || null,
      percentage: pct,
      sort_order: initialMilestones.length,
    })
    setSaving(false)
    if (error) {
      setAddError(error.message)
      return
    }
    setForm(emptyForm)
    setShowForm(false)
    router.refresh()
  }

  async function handleStatusChange(id: string, newStatus: MilestoneStatus) {
    setUpdatingId(id)
    await supabase.from('milestones').update({
      status: newStatus,
      ...(newStatus === 'completed' ? { completed_at: new Date().toISOString() } : {}),
      ...(newStatus === 'reopened' ? { completed_at: null } : {}),
    }).eq('id', id)
    setUpdatingId(null)
    router.refresh()
  }

  function openEditModal(m: Milestone) {
    setEditForm({
      title: m.title,
      type: m.type,
      phase: m.phase ?? '',
      due_date: m.due_date ?? '',
      description: m.description ?? '',
      percentage: String(m.percentage ?? 0),
    })
    setEditError(null)
    setEditModal(m)
  }

  function closeEditModal() {
    setEditModal(null)
    setEditError(null)
    setEditForm(emptyForm)
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editModal || !editForm.title.trim()) return

    const pct = Number(editForm.percentage) || 0
    if (pct < 0 || pct > 100) {
      setEditError('Percentage must be between 0 and 100.')
      return
    }
    const othersTotal = totalAssigned - (editModal.percentage ?? 0)
    if (othersTotal + pct > 100) {
      setEditError(`That would put this project at ${othersTotal + pct}% — only ${Math.max(0, 100 - othersTotal)}% is available for this stage.`)
      return
    }

    setEditSaving(true)
    const { error } = await supabase.from('milestones').update({
      title: editForm.title.trim(),
      type: editForm.type,
      phase: editForm.phase.trim() || null,
      due_date: editForm.due_date || null,
      description: editForm.description.trim() || null,
      percentage: pct,
    }).eq('id', editModal.id)
    setEditSaving(false)

    if (error) {
      setEditError(error.message)
      return
    }
    toast.success('Milestone updated')
    closeEditModal()
    router.refresh()
  }

  // No recipient picker, no email — the client sees this as a portal
  // notification the moment it's sent (see migration 030's write-up,
  // applied to milestones the same way it was to decisions).
  async function handleSendForSignoff(id: string) {
    setSendingId(id)
    const result = await sendMilestoneForSignoff(id)
    setSendingId(null)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success('Sent to the client for sign-off')
    router.refresh()
  }

  return (
    <div>
      {/* Toolbar */}
      {canManage && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            {totalAssigned}% of the project assigned across {initialMilestones.length} stage{initialMilestones.length === 1 ? '' : 's'}
          </span>
          <button
            onClick={() => { setShowForm(v => !v); setForm(emptyForm); setAddError(null) }}
            style={{
              padding: '7px 14px',
              background: showForm ? 'var(--bg-primary)' : '#EA580C',
              color: showForm ? 'var(--text-secondary)' : '#fff',
              border: showForm ? '0.5px solid var(--border-default)' : 'none',
              borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            }}
          >
            {showForm ? 'Cancel' : '+ Add milestone'}
          </button>
        </div>
      )}

      {/* Add form */}
      {canManage && showForm && (
        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '20px', marginBottom: '14px' }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Title *</label>
                <input type="text" required autoFocus value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. UAT Sign-off" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Type</label>
                <select value={form.type} onChange={e => set('type', e.target.value)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
                  <option value="internal">Internal</option>
                  <option value="client_gate">Client gate</option>
                  <option value="informational">Informational</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Phase</label>
                <input type="text" value={form.phase} onChange={e => set('phase', e.target.value)} placeholder="e.g. UAT" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Due date</label>
                <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                % of project ({remainingForAdd}% left to assign)
              </label>
              <input type="number" min={0} max={100} value={form.percentage} onChange={e => set('percentage', e.target.value)} placeholder="e.g. 20" style={inputStyle} />
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional details…" rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }} />
            </div>

            {addError && (
              <div style={{ fontSize: '12px', color: 'var(--danger-text)', background: 'var(--danger-bg)', borderRadius: '6px', padding: '8px 10px' }}>
                {addError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '7px 14px', border: '0.5px solid var(--border-medium)', borderRadius: '7px', fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-primary)', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={saving || !form.title.trim()} style={{ padding: '7px 16px', background: saving || !form.title.trim() ? '#FED7AA' : '#EA580C', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 500, cursor: saving || !form.title.trim() ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Adding…' : 'Add milestone'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {initialMilestones.map(m => {
          const type = TYPE_CONFIG[m.type] ?? TYPE_CONFIG.internal
          const status = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.not_started
          const nextStatuses = NEXT_STATUSES[m.status] ?? []
          const isUpdating = updatingId === m.id
          const isSending = sendingId === m.id
          const canSend = m.type === 'client_gate' && SEND_ELIGIBLE.includes(m.status)

          return (
            <div key={m.id} style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{m.title}</span>
                    {m.iteration > 1 && <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: '5px' }}>v{m.iteration}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: type.bg, color: type.color, fontWeight: 500 }}>{type.label}</span>
                    <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: 'var(--brand-50)', color: 'var(--brand-800)', fontWeight: 500 }}>{m.percentage}% of project</span>
                    {m.phase && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{m.phase}</span>}
                    {m.due_date && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Due {formatDate(m.due_date)}</span>}
                    {m.completed_at && <span style={{ fontSize: '11px', color: 'var(--success-text)' }}>Completed {formatDate(m.completed_at)}</span>}
                  </div>
                  {m.description && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '7px 0 0', lineHeight: 1.5 }}>{m.description}</p>}
                  {m.delay_owner === 'client' && m.delay_reason && (
                    <div style={{ marginTop: '8px', padding: '7px 10px', background: 'var(--warning-bg)', borderRadius: '7px', fontSize: '12px', color: 'var(--warning-text)' }}>
                      ⚠ Concern from client: "{m.delay_reason}"
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: status.bg, color: status.color, fontWeight: 500 }}>
                    {status.label}
                  </span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {canManage && (
                      <button
                        onClick={() => openEditModal(m)}
                        style={{
                          fontSize: '11px', padding: '3px 9px', borderRadius: '6px',
                          border: '0.5px solid var(--border-default)', background: 'var(--bg-primary)',
                          color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 500,
                        }}
                      >
                        Edit
                      </button>
                    )}
                    {canManage && canSend && (
                      <button
                        disabled={isSending}
                        onClick={() => handleSendForSignoff(m.id)}
                        style={{
                          fontSize: '11px', padding: '3px 9px', borderRadius: '6px',
                          border: '0.5px solid #EA580C', background: 'var(--bg-primary)',
                          color: '#EA580C', cursor: isSending ? 'not-allowed' : 'pointer', fontWeight: 500,
                        }}
                      >
                        {isSending ? 'Sending…' : 'Send for sign-off'}
                      </button>
                    )}
                    {canManage && nextStatuses.length > 0 && nextStatuses.map(s => (
                      <button
                        key={s}
                        disabled={isUpdating}
                        onClick={() => handleStatusChange(m.id, s)}
                        style={{
                          fontSize: '11px', padding: '3px 9px', borderRadius: '6px',
                          border: '0.5px solid var(--border-default)', background: 'var(--bg-tertiary)',
                          color: 'var(--text-secondary)', cursor: isUpdating ? 'not-allowed' : 'pointer', fontWeight: 500,
                        }}
                      >
                        → {STATUS_CONFIG[s]?.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {initialMilestones.length === 0 && !showForm && (
          <div style={{ padding: '48px 32px', textAlign: 'center', background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>No milestones yet</div>
            {canManage && (
              <button onClick={() => setShowForm(true)} style={{ fontSize: '13px', color: '#EA580C', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Add the first milestone →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Edit milestone modal */}
      {editModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={e => { if (e.target === e.currentTarget) closeEditModal() }}
        >
          <div style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '24px', width: '460px', maxWidth: '90vw' }}>
            <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '16px' }}>Edit milestone</div>

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Title *</label>
                <input type="text" required autoFocus value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Type</label>
                  <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value as MilestoneType }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="internal">Internal</option>
                    <option value="client_gate">Client gate</option>
                    <option value="informational">Informational</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    % of project ({Math.max(0, 100 - (totalAssigned - (editModal.percentage ?? 0)))}% available)
                  </label>
                  <input type="number" min={0} max={100} value={editForm.percentage} onChange={e => setEditForm(f => ({ ...f, percentage: e.target.value }))} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Phase</label>
                  <input type="text" value={editForm.phase} onChange={e => setEditForm(f => ({ ...f, phase: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Due date</label>
                  <input type="date" value={editForm.due_date} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Description</label>
                <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }} />
              </div>

              {editError && (
                <div style={{ fontSize: '12px', color: 'var(--danger-text)', background: 'var(--danger-bg)', borderRadius: '6px', padding: '8px 10px' }}>
                  {editError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button type="button" onClick={closeEditModal} disabled={editSaving} style={{ padding: '7px 14px', border: '0.5px solid var(--border-medium)', borderRadius: '7px', fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-primary)', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving || !editForm.title.trim()}
                  style={{ padding: '7px 16px', background: editSaving || !editForm.title.trim() ? '#FED7AA' : '#EA580C', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 500, cursor: editSaving || !editForm.title.trim() ? 'not-allowed' : 'pointer' }}
                >
                  {editSaving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
