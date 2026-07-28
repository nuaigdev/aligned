'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { createBrowserClient } from '@/lib/supabase/client'
import { formatDate, formatDecisionRef } from '@/lib/utils'
import type { Decision, DecisionStatus } from '@/types'

const STATUS_CONFIG: Record<DecisionStatus, { label: string; bg: string; color: string }> = {
  draft:            { label: 'Draft',            bg: 'var(--bg-tertiary)',  color: 'var(--text-tertiary)' },
  pending_approval: { label: 'Pending approval', bg: 'var(--warning-bg)',   color: 'var(--warning-text)' },
  approved:         { label: 'Approved',         bg: 'var(--success-bg)',   color: 'var(--success-text)' },
  amended:          { label: 'Amended',          bg: 'var(--info-bg)',      color: 'var(--info-text)' },
  declined:         { label: 'Declined',         bg: 'var(--danger-bg)',    color: 'var(--danger-text)' },
  on_hold:          { label: 'On hold',          bg: 'var(--warning-bg)',   color: 'var(--warning-text)' },
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px',
  border: '0.5px solid var(--border-medium)', borderRadius: '7px',
  fontSize: '13px', color: 'var(--text-primary)', outline: 'none',
  boxSizing: 'border-box', background: 'var(--bg-primary)',
}

const emptyForm = { title: '', description: '', meeting_ref: '', milestone_id: '' }

interface MilestoneOption { id: string; title: string }

export default function DecisionsPanel({
  projectId,
  initialDecisions,
  milestones,
  canManage,
}: {
  projectId: string
  initialDecisions: Decision[]
  milestones: MilestoneOption[]
  canManage: boolean
}) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [amendModal, setAmendModal] = useState<{ decision: Decision } | null>(null)
  const [amendForm, setAmendForm] = useState({ title: '', description: '', meeting_ref: '', milestone_id: '' })
  const [amendSaving, setAmendSaving] = useState(false)
  const [amendError, setAmendError] = useState<string | null>(null)

  const milestoneTitleById = new Map(milestones.map(m => [m.id, m.title]))

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)

    const { data: nextRef } = await supabase.rpc('next_decision_ref', { p_project_id: projectId })

    await supabase.from('decisions').insert({
      project_id: projectId,
      ref_number: nextRef ?? 1,
      title: form.title.trim(),
      description: form.description.trim() || null,
      meeting_ref: form.meeting_ref.trim() || null,
      milestone_id: form.milestone_id || null,
      status: 'draft',
    })

    setForm(emptyForm)
    setShowForm(false)
    setSaving(false)
    router.refresh()
  }

  // No recipient picker, no email — the client sees this pending on
  // their portal the moment it's sent (see migration 030's write-up).
  async function handleSendForApproval(id: string) {
    setUpdatingId(id)
    const { error } = await supabase.from('decisions').update({ status: 'pending_approval' }).eq('id', id)
    setUpdatingId(null)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Sent to the client for approval')
    router.refresh()
  }

  function openAmendModal(decision: Decision) {
    setAmendForm({
      title: `Amendment: ${decision.title}`,
      description: '',
      meeting_ref: '',
      milestone_id: decision.milestone_id ?? '',
    })
    setAmendError(null)
    setAmendModal({ decision })
  }

  function closeAmendModal() {
    setAmendModal(null)
    setAmendError(null)
    setAmendForm({ title: '', description: '', meeting_ref: '', milestone_id: '' })
  }

  async function handleAmendSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amendModal || !amendForm.title.trim()) return
    setAmendSaving(true)
    setAmendError(null)

    try {
      const { data: nextRef } = await supabase.rpc('next_decision_ref', { p_project_id: projectId })

      const { error } = await supabase.from('decisions').insert({
        project_id: projectId,
        ref_number: nextRef ?? 1,
        title: amendForm.title.trim(),
        description: amendForm.description.trim() || null,
        meeting_ref: amendForm.meeting_ref.trim() || null,
        milestone_id: amendForm.milestone_id || null,
        status: 'draft',
        parent_id: amendModal.decision.id,
      })

      if (error) {
        setAmendError(error.message)
        setAmendSaving(false)
        return
      }
    } catch {
      setAmendError('Failed to create amendment')
      setAmendSaving(false)
      return
    }

    setAmendSaving(false)
    closeAmendModal()
    router.refresh()
  }

  return (
    <div>
      {/* Toolbar */}
      {canManage && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
          <button
            onClick={() => { setShowForm(v => !v); setForm(emptyForm) }}
            style={{
              padding: '7px 14px',
              background: showForm ? 'var(--bg-primary)' : '#EA580C',
              color: showForm ? 'var(--text-secondary)' : '#fff',
              border: showForm ? '0.5px solid var(--border-default)' : 'none',
              borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            }}
          >
            {showForm ? 'Cancel' : '+ Add decision'}
          </button>
        </div>
      )}

      {/* Add form */}
      {canManage && showForm && (
        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '20px', marginBottom: '14px' }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Title *</label>
              <input type="text" required autoFocus value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Approved wireframe designs" style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'start' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Description</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Decision details and rationale…" rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }} />
              </div>
              <div style={{ minWidth: '150px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Meeting ref</label>
                <input type="text" value={form.meeting_ref} onChange={e => set('meeting_ref', e.target.value)} placeholder="e.g. Meeting #3" style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Stage (optional)</label>
              <select value={form.milestone_id} onChange={e => set('milestone_id', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">Not tied to a stage</option>
                {milestones.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '7px 14px', border: '0.5px solid var(--border-medium)', borderRadius: '7px', fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-primary)', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={saving || !form.title.trim()} style={{ padding: '7px 16px', background: saving || !form.title.trim() ? '#FED7AA' : '#EA580C', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 500, cursor: saving || !form.title.trim() ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Adding…' : 'Add decision'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {initialDecisions.map(d => {
          const status = STATUS_CONFIG[d.status] ?? STATUS_CONFIG.draft
          const isUpdating = updatingId === d.id
          const stageName = d.milestone_id ? milestoneTitleById.get(d.milestone_id) : null

          return (
            <div key={d.id} style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 500, color: '#EA580C', background: 'var(--brand-50)', padding: '3px 8px', borderRadius: '6px', flexShrink: 0, marginTop: '2px', fontFamily: 'monospace' }}>
                  {formatDecisionRef(d.ref_number)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>{d.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {stageName && (
                      <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 500 }}>{stageName}</span>
                    )}
                    {d.meeting_ref && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{d.meeting_ref}</span>}
                    {d.signed_by_name && (
                      <span style={{ fontSize: '11px', color: 'var(--success-text)' }}>
                        Signed by {d.signed_by_name} · {formatDate(d.signed_at)}
                      </span>
                    )}
                  </div>
                  {d.description && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.5 }}>{d.description}</p>}
                  {(d.status === 'declined' || d.status === 'on_hold') && d.client_decided_by_name && (
                    <div style={{ marginTop: '8px', padding: '7px 10px', background: 'var(--bg-tertiary)', borderRadius: '7px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {d.status === 'declined' ? 'Declined' : 'Put on hold'} by {d.client_decided_by_name}{d.decided_at ? ` · ${formatDate(d.decided_at)}` : ''}
                      {d.client_decision_comment && <div style={{ marginTop: '3px', fontStyle: 'italic' }}>"{d.client_decision_comment}"</div>}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: status.bg, color: status.color, fontWeight: 500 }}>
                    {status.label}
                  </span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {canManage && (d.status === 'draft' || d.status === 'on_hold') && (
                      <button
                        disabled={isUpdating}
                        onClick={() => handleSendForApproval(d.id)}
                        style={{
                          fontSize: '11px', padding: '3px 9px', borderRadius: '6px',
                          border: '0.5px solid #EA580C', background: 'var(--bg-primary)',
                          color: '#EA580C', cursor: isUpdating ? 'not-allowed' : 'pointer', fontWeight: 500,
                        }}
                      >
                        {isUpdating ? 'Sending…' : d.status === 'on_hold' ? 'Resend for approval' : 'Send for approval'}
                      </button>
                    )}
                    {canManage && d.status === 'approved' && (
                      <button
                        disabled={isUpdating}
                        onClick={() => openAmendModal(d)}
                        style={{
                          fontSize: '11px', padding: '3px 9px', borderRadius: '6px',
                          border: '0.5px solid var(--border-default)', background: 'var(--bg-tertiary)',
                          color: 'var(--text-secondary)', cursor: isUpdating ? 'not-allowed' : 'pointer', fontWeight: 500,
                        }}
                      >
                        Create amendment
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {initialDecisions.length === 0 && !showForm && (
          <div style={{ padding: '48px 32px', textAlign: 'center', background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>No decisions recorded yet</div>
            {canManage && (
              <button onClick={() => setShowForm(true)} style={{ fontSize: '13px', color: '#EA580C', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Add the first decision →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Create amendment modal */}
      {amendModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={e => { if (e.target === e.currentTarget) closeAmendModal() }}
        >
          <div style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '24px', width: '440px', maxWidth: '90vw' }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>Create amendment</div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                Amendment of {formatDecisionRef(amendModal.decision.ref_number)} · {amendModal.decision.title}
              </div>
            </div>

            <form onSubmit={handleAmendSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Title *</label>
                <input
                  type="text" required autoFocus
                  value={amendForm.title}
                  onChange={e => setAmendForm(f => ({ ...f, title: e.target.value }))}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Description</label>
                <textarea
                  value={amendForm.description}
                  onChange={e => setAmendForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What changed and why…"
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Meeting ref</label>
                <input
                  type="text"
                  value={amendForm.meeting_ref}
                  onChange={e => setAmendForm(f => ({ ...f, meeting_ref: e.target.value }))}
                  placeholder="e.g. Meeting #5"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Stage (optional)</label>
                <select value={amendForm.milestone_id} onChange={e => setAmendForm(f => ({ ...f, milestone_id: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Not tied to a stage</option>
                  {milestones.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>

              {amendError && (
                <div style={{ fontSize: '12px', color: 'var(--danger-text)', background: 'var(--danger-bg)', borderRadius: '6px', padding: '8px 10px' }}>
                  {amendError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={closeAmendModal}
                  style={{ padding: '7px 14px', border: '0.5px solid var(--border-medium)', borderRadius: '7px', fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-primary)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={amendSaving || !amendForm.title.trim()}
                  style={{
                    padding: '7px 16px',
                    background: amendSaving || !amendForm.title.trim() ? '#FED7AA' : '#EA580C',
                    color: '#fff', border: 'none', borderRadius: '7px',
                    fontSize: '13px', fontWeight: 500,
                    cursor: amendSaving || !amendForm.title.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {amendSaving ? 'Creating…' : 'Create amendment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
