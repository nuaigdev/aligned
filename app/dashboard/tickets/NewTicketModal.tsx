'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Check, Search } from 'lucide-react'
import { createTicket } from '@/lib/tickets/team-actions'
import { getInitials } from '@/lib/utils'
import type { Client, TeamMember, Project, TicketPriority } from '@/types'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px',
  border: '0.5px solid var(--border-medium)', borderRadius: '7px',
  fontSize: '13px', color: 'var(--text-primary)', outline: 'none',
  boxSizing: 'border-box', background: 'var(--bg-primary)',
}

const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high', 'urgent']
const CATEGORIES = ['general', 'bug', 'feature_request', 'question', 'billing']

export default function NewTicketModal({
  onClose,
  clients,
  projects,
  teamMembers,
}: {
  onClose: () => void
  clients: Client[]
  projects: Project[]
  teamMembers: TeamMember[]
}) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [priority, setPriority] = useState<TicketPriority>('medium')
  const [category, setCategory] = useState('general')
  const [dueDate, setDueDate] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [personSearch, setPersonSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedClient = clients.find(c => c.id === clientId)
  const clientProjects = projects.filter(p => p.client_id === clientId)

  // Candidate assignees: the client's Manager + that Manager's direct reports —
  // mirrors migration 010's is_on_client_team() predicate, computed here for the
  // picker (the DB still enforces it authoritatively on insert).
  const candidatePool = useMemo(() => {
    if (!selectedClient) return []
    return teamMembers.filter(m =>
      m.role === 'admin' ||
      m.id === selectedClient.manager_id ||
      (selectedClient.manager_id && m.manager_id === selectedClient.manager_id)
    )
  }, [selectedClient, teamMembers])

  const filteredPeople = candidatePool.filter(p =>
    !personSearch.trim() || p.name.toLowerCase().includes(personSearch.toLowerCase())
  )

  function toggleAssignee(id: string) {
    setAssigneeIds(cur => (cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]))
  }

  async function handleSave() {
    if (!title.trim()) return toast.error('Give the ticket a title')
    if (!clientId) return toast.error('Pick a client')

    setSaving(true)
    const result = await createTicket({
      client_id: clientId,
      project_id: projectId || undefined,
      title,
      description,
      category,
      priority,
      due_date: dueDate || undefined,
      assignee_ids: assigneeIds,
    })
    setSaving(false)

    if ('error' in result) {
      toast.error(result.error)
      return
    }

    toast.success('Ticket created')
    onClose()
    router.push(`/dashboard/tickets/${result.id}`)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.18 }}
        style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '24px', width: '520px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '16px' }}>New ticket</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Title *</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="What's going on?" style={inputStyle} />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Client *</label>
              <select value={clientId} onChange={e => { setClientId(e.target.value); setProjectId(''); setAssigneeIds([]) }} style={inputStyle}>
                <option value="">Select a client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Project (optional)</label>
              <select value={projectId} onChange={e => setProjectId(e.target.value)} disabled={!clientId} style={inputStyle}>
                <option value="">No specific project</option>
                {clientProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Due date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Priority</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {PRIORITIES.map(p => (
                <button
                  key={p} type="button" onClick={() => setPriority(p)}
                  style={{
                    flex: 1, padding: '7px', borderRadius: '7px', fontSize: '12px', fontWeight: 500, textTransform: 'capitalize', cursor: 'pointer',
                    border: priority === p ? '1px solid #534AB7' : '0.5px solid var(--border-medium)',
                    background: priority === p ? 'var(--brand-50)' : 'var(--bg-primary)',
                    color: priority === p ? '#534AB7' : 'var(--text-secondary)',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
              Assignees{assigneeIds.length > 0 ? ` (${assigneeIds.length})` : ''}
            </label>
            <div style={{ border: '0.5px solid var(--border-medium)', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderBottom: '0.5px solid var(--border-default)' }}>
                <Search size={13} color="var(--text-tertiary)" />
                <input
                  value={personSearch} onChange={e => setPersonSearch(e.target.value)}
                  placeholder={clientId ? 'Search the client\'s team…' : 'Pick a client first'}
                  disabled={!clientId}
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '13px', color: 'var(--text-primary)' }}
                />
              </div>
              <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                {!clientId ? (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-tertiary)' }}>Select a client to see who can be assigned</div>
                ) : filteredPeople.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-tertiary)' }}>No one matches — assign a Manager to this client first</div>
                ) : (
                  filteredPeople.map(p => {
                    const selected = assigneeIds.includes(p.id)
                    return (
                      <button
                        key={p.id} type="button" onClick={() => toggleAssignee(p.id)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px',
                          background: selected ? 'var(--brand-50)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                          borderBottom: '0.5px solid var(--border-default)',
                        }}
                      >
                        <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--brand-50)', color: 'var(--brand-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 500, flexShrink: 0 }}>
                          {getInitials(p.name)}
                        </div>
                        <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)' }}>{p.name}</span>
                        {selected && <Check size={13} color="#534AB7" />}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
            <button onClick={onClose} disabled={saving} style={{ padding: '8px 16px', borderRadius: '8px', border: '0.5px solid var(--border-medium)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              onClick={handleSave} disabled={saving || !title.trim() || !clientId}
              style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#534AB7', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Creating…' : 'Create ticket'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
