'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { formatDate, formatDecisionRef } from '@/lib/utils'
import type { Decision, DecisionStatus } from '@/types'

const STATUS_CONFIG: Record<DecisionStatus, { label: string; bg: string; color: string }> = {
  draft:            { label: 'Draft',            bg: 'var(--bg-tertiary)',  color: 'var(--text-tertiary)' },
  pending_approval: { label: 'Pending approval', bg: 'var(--warning-bg)',   color: 'var(--warning-text)' },
  approved:         { label: 'Approved',         bg: 'var(--success-bg)',   color: 'var(--success-text)' },
  amended:          { label: 'Amended',          bg: 'var(--info-bg)',      color: 'var(--info-text)' },
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px',
  border: '0.5px solid var(--border-medium)', borderRadius: '7px',
  fontSize: '13px', color: 'var(--text-primary)', outline: 'none',
  boxSizing: 'border-box', background: 'var(--bg-primary)',
}

const emptyForm = { title: '', description: '', meeting_ref: '' }

interface Contact { id: string; name: string; email: string }

export default function DecisionsPanel({
  projectId,
  initialDecisions,
  contacts,
}: {
  projectId: string
  initialDecisions: Decision[]
  contacts: Contact[]
}) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [sendModal, setSendModal] = useState<{ decision: Decision } | null>(null)
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const [amendModal, setAmendModal] = useState<{ decision: Decision } | null>(null)
  const [amendForm, setAmendForm] = useState({ title: '', description: '', meeting_ref: '' })
  const [amendSaving, setAmendSaving] = useState(false)
  const [amendError, setAmendError] = useState<string | null>(null)

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
      status: 'draft',
    })

    setForm(emptyForm)
    setShowForm(false)
    setSaving(false)
    router.refresh()
  }

  async function handleStatusChange(id: string, newStatus: DecisionStatus) {
    setUpdatingId(id)
    await supabase.from('decisions').update({ status: newStatus }).eq('id', id)
    setUpdatingId(null)
    router.refresh()
  }

  function openSendModal(decision: Decision) {
    setSelectedContacts(new Set())
    setSendError(null)
    setSendModal({ decision })
  }

  function closeSendModal() {
    setSendModal(null)
    setSendError(null)
    setSelectedContacts(new Set())
  }

  function toggleContact(id: string) {
    setSelectedContacts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSend() {
    if (!sendModal || selectedContacts.size === 0) return
    setSending(true)
    setSendError(null)

    const recipients = contacts
      .filter(c => selectedContacts.has(c.id))
      .map(c => ({ name: c.name, email: c.email }))

    try {
      const res = await fetch('/api/approvals/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          target_type: 'decision',
          target_id: sendModal.decision.id,
          recipients,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setSendError(json.error || 'Failed to send')
        setSending(false)
        return
      }
    } catch {
      setSendError('Network error — please try again')
      setSending(false)
      return
    }

    setSending(false)
    closeSendModal()
    router.refresh()
  }

  function openAmendModal(decision: Decision) {
    setAmendForm({
      title: `Amendment: ${decision.title}`,
      description: '',
      meeting_ref: '',
    })
    setAmendError(null)
    setAmendModal({ decision })
  }

  function closeAmendModal() {
    setAmendModal(null)
    setAmendError(null)
    setAmendForm({ title: '', description: '', meeting_ref: '' })
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
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
        <button
          onClick={() => { setShowForm(v => !v); setForm(emptyForm) }}
          style={{
            padding: '7px 14px',
            background: showForm ? 'var(--bg-primary)' : '#534AB7',
            color: showForm ? 'var(--text-secondary)' : '#fff',
            border: showForm ? '0.5px solid var(--border-default)' : 'none',
            borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
          }}
        >
          {showForm ? 'Cancel' : '+ Add decision'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '7px 14px', border: '0.5px solid var(--border-medium)', borderRadius: '7px', fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-primary)', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={saving || !form.title.trim()} style={{ padding: '7px 16px', background: saving || !form.title.trim() ? '#AFA9EC' : '#534AB7', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 500, cursor: saving || !form.title.trim() ? 'not-allowed' : 'pointer' }}>
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

          return (
            <div key={d.id} style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 500, color: '#534AB7', background: 'var(--brand-50)', padding: '3px 8px', borderRadius: '6px', flexShrink: 0, marginTop: '2px', fontFamily: 'monospace' }}>
                  {formatDecisionRef(d.ref_number)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>{d.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {d.meeting_ref && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{d.meeting_ref}</span>}
                    {d.signed_by_name && (
                      <span style={{ fontSize: '11px', color: 'var(--success-text)' }}>
                        Signed by {d.signed_by_name} · {formatDate(d.signed_at)}
                      </span>
                    )}
                  </div>
                  {d.description && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '6px 0 0', lineHeight: 1.5 }}>{d.description}</p>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: status.bg, color: status.color, fontWeight: 500 }}>
                    {status.label}
                  </span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {d.status === 'draft' && (
                      <button
                        disabled={isUpdating}
                        onClick={() => openSendModal(d)}
                        style={{
                          fontSize: '11px', padding: '3px 9px', borderRadius: '6px',
                          border: '0.5px solid #534AB7', background: 'var(--bg-primary)',
                          color: '#534AB7', cursor: isUpdating ? 'not-allowed' : 'pointer', fontWeight: 500,
                        }}
                      >
                        Send for approval
                      </button>
                    )}
                    {d.status === 'approved' && (
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
            <button onClick={() => setShowForm(true)} style={{ fontSize: '13px', color: '#534AB7', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Add the first decision →
            </button>
          </div>
        )}
      </div>

      {/* Send for approval modal */}
      {sendModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={e => { if (e.target === e.currentTarget) closeSendModal() }}
        >
          <div style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '24px', width: '440px', maxWidth: '90vw' }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>Send for approval</div>
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>{sendModal.decision.title}</div>
            </div>

            {contacts.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', marginBottom: '16px' }}>
                No contacts configured for this client. Add contacts on the client page.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Select recipients</div>
                {contacts.map(c => (
                  <label
                    key={c.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '9px 12px', background: selectedContacts.has(c.id) ? 'var(--brand-50)' : 'var(--bg-secondary)',
                      border: selectedContacts.has(c.id) ? '0.5px solid #AFA9EC' : '0.5px solid var(--border-default)',
                      borderRadius: '8px', cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedContacts.has(c.id)}
                      onChange={() => toggleContact(c.id)}
                      style={{ accentColor: '#534AB7', width: '14px', height: '14px', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{c.email}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {sendError && (
              <div style={{ fontSize: '12px', color: 'var(--danger-text)', background: 'var(--danger-bg)', borderRadius: '6px', padding: '8px 10px', marginBottom: '14px' }}>
                {sendError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={closeSendModal}
                style={{ padding: '7px 14px', border: '0.5px solid var(--border-medium)', borderRadius: '7px', fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-primary)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || selectedContacts.size === 0 || contacts.length === 0}
                style={{
                  padding: '7px 16px',
                  background: sending || selectedContacts.size === 0 || contacts.length === 0 ? '#AFA9EC' : '#534AB7',
                  color: '#fff', border: 'none', borderRadius: '7px',
                  fontSize: '13px', fontWeight: 500,
                  cursor: sending || selectedContacts.size === 0 || contacts.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {sending ? 'Sending…' : `Send to ${selectedContacts.size > 0 ? selectedContacts.size : ''} ${selectedContacts.size === 1 ? 'recipient' : 'recipients'}`.trim()}
              </button>
            </div>
          </div>
        </div>
      )}

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
                    background: amendSaving || !amendForm.title.trim() ? '#AFA9EC' : '#534AB7',
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
