'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Pencil, Check } from 'lucide-react'
import { updateTicket } from '@/lib/tickets/team-actions'
import { formatTicketRef } from '@/lib/utils'
import type { Ticket } from '@/types'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px', border: '0.5px solid var(--border-medium)', borderRadius: '7px',
  fontSize: '13px', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', background: 'var(--bg-primary)',
}

/**
 * The main-content header — just title + description. Everything
 * else (status, priority, category, due date, assignees) lives in
 * TicketPropertiesPanel, docked to the side, matching how an actual
 * issue tracker splits "content" from "fields."
 */
export default function TicketDetail({ ticket, clientCode, canAct = true }: { ticket: Ticket; clientCode?: string; canAct?: boolean }) {
  const [title, setTitle] = useState(ticket.title)
  const [description, setDescription] = useState(ticket.description ?? '')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ title, description })
  const [saving, setSaving] = useState(false)

  function startEditing() {
    setDraft({ title, description })
    setEditing(true)
  }

  async function save() {
    if (!draft.title.trim()) {
      toast.error('Title cannot be empty')
      return
    }
    setSaving(true)
    const result = await updateTicket(ticket.id, { title: draft.title.trim(), description: draft.description.trim() || null })
    setSaving(false)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    setTitle(draft.title.trim())
    setDescription(draft.description.trim())
    setEditing(false)
    toast.success('Ticket updated')
  }

  return (
    <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>{formatTicketRef(ticket.ref_number, clientCode)}</div>
        {!editing && canAct && (
          <button onClick={startEditing} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-600)', fontSize: '12px', flexShrink: 0 }}>
            <Pencil size={12} /> Edit
          </button>
        )}
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input autoFocus value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} style={{ ...inputStyle, fontSize: '18px', fontWeight: 500 }} />
          <textarea value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} rows={4} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setEditing(false)} disabled={saving} style={{ padding: '7px 14px', borderRadius: '7px', border: '0.5px solid var(--border-medium)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={save} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '7px', border: 'none', background: 'var(--brand-600)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              <Check size={13} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <h1 style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 8px' }}>{title}</h1>
          {description && (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{description}</p>
          )}
        </>
      )}
    </div>
  )
}
