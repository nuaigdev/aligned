'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
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

const emptyForm = { title: '', type: 'internal' as MilestoneType, phase: '', due_date: '', description: '' }

interface Contact { id: string; name: string; email: string }

export default function MilestonesPanel({
  projectId,
  initialMilestones,
  contacts,
}: {
  projectId: string
  initialMilestones: Milestone[]
  contacts: Contact[]
}) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [sendModal, setSendModal] = useState<{ milestone: Milestone } | null>(null)
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    await supabase.from('milestones').insert({
      project_id: projectId,
      title: form.title.trim(),
      type: form.type,
      phase: form.phase.trim() || null,
      due_date: form.due_date || null,
      description: form.description.trim() || null,
      sort_order: initialMilestones.length,
    })
    setForm(emptyForm)
    setShowForm(false)
    setSaving(false)
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

  function openSendModal(milestone: Milestone) {
    setSelectedContacts(new Set())
    setSendError(null)
    setSendModal({ milestone })
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
          target_type: 'milestone',
          target_id: sendModal.milestone.id,
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

  return (
    <div>
      {/* Toolbar */}
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
          {showForm ? 'Cancel' : '+ Add milestone'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
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
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional details…" rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }} />
            </div>

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
                    {m.phase && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{m.phase}</span>}
                    {m.due_date && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Due {formatDate(m.due_date)}</span>}
                    {m.completed_at && <span style={{ fontSize: '11px', color: 'var(--success-text)' }}>Completed {formatDate(m.completed_at)}</span>}
                  </div>
                  {m.description && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '7px 0 0', lineHeight: 1.5 }}>{m.description}</p>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: status.bg, color: status.color, fontWeight: 500 }}>
                    {status.label}
                  </span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {canSend && (
                      <button
                        onClick={() => openSendModal(m)}
                        style={{
                          fontSize: '11px', padding: '3px 9px', borderRadius: '6px',
                          border: '0.5px solid #EA580C', background: 'var(--bg-primary)',
                          color: '#EA580C', cursor: 'pointer', fontWeight: 500,
                        }}
                      >
                        Send for sign-off
                      </button>
                    )}
                    {nextStatuses.length > 0 && nextStatuses.map(s => (
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
            <button onClick={() => setShowForm(true)} style={{ fontSize: '13px', color: '#EA580C', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Add the first milestone →
            </button>
          </div>
        )}
      </div>

      {/* Send for sign-off modal */}
      {sendModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
          onClick={e => { if (e.target === e.currentTarget) closeSendModal() }}
        >
          <div style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '24px', width: '440px', maxWidth: '90vw' }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>Send for sign-off</div>
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>{sendModal.milestone.title}</div>
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
                      border: selectedContacts.has(c.id) ? '0.5px solid #FED7AA' : '0.5px solid var(--border-default)',
                      borderRadius: '8px', cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedContacts.has(c.id)}
                      onChange={() => toggleContact(c.id)}
                      style={{ accentColor: '#EA580C', width: '14px', height: '14px', cursor: 'pointer' }}
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
                  background: sending || selectedContacts.size === 0 || contacts.length === 0 ? '#FED7AA' : '#EA580C',
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
    </div>
  )
}
