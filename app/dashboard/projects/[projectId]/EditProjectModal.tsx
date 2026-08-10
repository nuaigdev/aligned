'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Pencil } from 'lucide-react'
import { updateProject } from '@/lib/projects/actions'
import type { Project, ProjectStatus } from '@/types'

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'awaiting_client', label: 'Awaiting client' },
  { value: 'awaiting_team', label: 'Awaiting team' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
]

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '0.5px solid var(--border-medium)', borderRadius: '8px',
  fontSize: '14px', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', background: 'var(--bg-primary)',
}

const labelStyle: React.CSSProperties = {
  fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px',
}

// Postgres `date` columns come back as 'YYYY-MM-DD' already, but guard
// against a stray timestamp anyway so the <input type="date"> never
// chokes on a value it can't parse.
function toDateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : ''
}

export default function EditProjectModal({ project }: { project: Project }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [status, setStatus] = useState<ProjectStatus>(project.status)
  const [startDate, setStartDate] = useState(toDateInputValue(project.started_at))
  const [endDate, setEndDate] = useState(toDateInputValue(project.planned_end_at))
  const [busy, setBusy] = useState(false)

  function openModal() {
    setName(project.name)
    setDescription(project.description ?? '')
    setStatus(project.status)
    setStartDate(toDateInputValue(project.started_at))
    setEndDate(toDateInputValue(project.planned_end_at))
    setOpen(true)
  }

  async function handleSave() {
    if (!name.trim()) return toast.error('Give the project a name.')
    setBusy(true)
    const result = await updateProject(project.id, {
      name: name.trim(),
      description: description.trim() || undefined,
      status,
      startedAt: startDate || undefined,
      plannedEndAt: endDate || undefined,
    })
    setBusy(false)

    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success('Project updated')
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={openModal}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '7px 12px', borderRadius: '8px', border: '0.5px solid var(--border-medium)',
          background: 'var(--bg-primary)', color: 'var(--text-secondary)',
          fontSize: '13px', fontWeight: 500, cursor: 'pointer', flexShrink: 0,
        }}
      >
        <Pencil size={13} /> Edit
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
            onClick={e => { if (e.target === e.currentTarget && !busy) setOpen(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.18 }}
              style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '24px', width: '480px', maxWidth: '90vw' }}
            >
              <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '16px' }}>
                Edit project
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>
                    Project name <span style={{ color: 'var(--danger-text)' }}>*</span>
                  </label>
                  <input autoFocus value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Description</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value as ProjectStatus)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={labelStyle}>Start date</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Target end date</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '0.5px solid var(--border-medium)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={busy || !name.trim()}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: 'none',
                    background: busy || !name.trim() ? '#FED7AA' : '#EA580C',
                    color: '#fff', fontSize: '13px', fontWeight: 500,
                    cursor: busy || !name.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
