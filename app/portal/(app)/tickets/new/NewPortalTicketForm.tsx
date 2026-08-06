'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Paperclip, Upload, X } from 'lucide-react'
import { createPortalTicket, uploadDraftPortalAttachment, removeDraftPortalAttachment } from '@/lib/tickets/portal-actions'
import { formatFileSize } from '@/lib/utils'
import ContactNamePicker, { useRememberedContactName } from '../ContactNamePicker'
import type { TicketPriority } from '@/types'

interface DraftAttachment {
  storage_path: string
  name: string
  file_type: string | null
  file_size_bytes: number
}

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
  const [attachments, setAttachments] = useState<DraftAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.set('file', file)
    const result = await uploadDraftPortalAttachment(formData)
    setUploading(false)

    if ('error' in result) {
      toast.error(result.error)
      return
    }
    setAttachments(cur => [...cur, result])
  }

  async function handleRemoveAttachment(a: DraftAttachment) {
    setAttachments(cur => cur.filter(x => x.storage_path !== a.storage_path))
    const result = await removeDraftPortalAttachment(a.storage_path)
    if ('error' in result) {
      // Already removed from the list — surface the failure but don't
      // re-add it, the file object is still selectable again if needed.
      toast.error(result.error)
    }
  }

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
      attachments: attachments.length > 0 ? attachments : undefined,
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

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: attachments.length > 0 ? '6px' : '4px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Paperclip size={12} /> Attachments
          </span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: uploading ? 'default' : 'pointer', color: 'var(--brand-600)', fontSize: '12px' }}
          >
            <Upload size={12} /> {uploading ? 'Uploading…' : 'Attach a file'}
          </button>
          <input ref={fileInputRef} type="file" onChange={handleFileInput} style={{ display: 'none' }} />
        </div>

        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {attachments.map(a => (
              <div key={a.storage_path} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 9px', background: 'var(--bg-tertiary)', borderRadius: '7px' }}>
                <span style={{ fontSize: '14px', flexShrink: 0 }}>📎</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{formatFileSize(a.file_size_bytes)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(a)}
                  title="Remove — wrong file attached by mistake"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: '3px' }}
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: attachments.length > 0 ? '6px 0 0' : '4px 0 0' }}>
          You can remove a file here before submitting. Once the ticket is raised, attachments become a permanent part of the record.
        </p>
      </div>

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
