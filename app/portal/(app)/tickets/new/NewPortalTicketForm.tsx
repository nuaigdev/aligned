'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { createPortalTicket } from '@/lib/tickets/portal-actions'
import ContactNamePicker, { useRememberedContactName } from '../ContactNamePicker'
import type { TicketPriority } from '@/types'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '0.5px solid var(--border-medium)', borderRadius: '8px',
  fontSize: '14px', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
}

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General',
  bug: 'Something is broken',
  feature_request: 'A new feature or change',
  question: 'A question',
  billing: 'Billing',
}

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low — no rush',
  medium: 'Medium — normal priority',
  high: 'High — needs attention soon',
  urgent: 'Urgent — blocking us right now',
}

export default function NewPortalTicketForm({
  contacts,
  projects,
  canSetPriority,
}: {
  contacts: { id: string; name: string }[]
  projects: { id: string; name: string }[]
  canSetPriority: boolean
}) {
  const router = useRouter()
  const [contactName, setContactName] = useRememberedContactName()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('general')
  const [priority, setPriority] = useState<TicketPriority>('medium')
  const [projectId, setProjectId] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return toast.error('Give the ticket a short title')
    if (!contactName.trim()) return toast.error('Let us know who this is from')

    setSaving(true)
    const result = await createPortalTicket({
      title,
      description,
      category,
      priority: canSetPriority ? priority : undefined,
      project_id: projectId || undefined,
      contact_name: contactName,
    })
    setSaving(false)

    if ('error' in result) {
      toast.error(result.error)
      return
    }

    toast.success("Ticket submitted — we'll be in touch")
    router.push(`/portal/tickets/${result.id}`)
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '520px' }}
    >
      <ContactNamePicker contacts={contacts} value={contactName} onChange={setContactName} />

      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>What's this about? *</label>
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. 'Can't log in to the dashboard'" style={inputStyle} />
      </div>

      <div>
        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tell us more</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          placeholder="The more detail you give us, the faster we can help — what happened, when, and what you expected instead."
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: canSetPriority ? '1fr 1fr' : '1fr', gap: '12px' }}>
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>What kind of request is this?</label>
          <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        {canSetPriority && (
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>How urgent is it?</label>
            <select value={priority} onChange={e => setPriority(e.target.value as TicketPriority)} style={inputStyle}>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        )}
      </div>

      {projects.length > 0 && (
        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Is this about a specific project?</label>
          <select value={projectId} onChange={e => setProjectId(e.target.value)} style={inputStyle}>
            <option value="">Not tied to a specific project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        style={{ padding: '10px', border: 'none', borderRadius: '8px', background: saving ? 'var(--brand-200)' : 'var(--brand-600)', color: '#fff', fontSize: '14px', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', marginTop: '4px' }}
      >
        {saving ? 'Submitting…' : 'Submit ticket'}
      </button>
      <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', margin: 0 }}>
        You'll get an email confirmation, and can follow progress right here.
      </p>
    </motion.form>
  )
}
