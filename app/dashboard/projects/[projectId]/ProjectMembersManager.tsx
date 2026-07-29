'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Search } from 'lucide-react'
import { addProjectMember, removeProjectMember } from '@/lib/projects/members-actions'
import { getInitials } from '@/lib/utils'
import type { TeamMember } from '@/types'

export default function ProjectMembersManager({
  projectId,
  initialMembers,
  allTeamMembers,
}: {
  projectId: string
  initialMembers: TeamMember[]
  allTeamMembers: TeamMember[]
}) {
  const [members, setMembers] = useState(initialMembers)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [search, setSearch] = useState('')

  const availableToAdd = allTeamMembers.filter(m => !members.some(c => c.id === m.id))
  const filtered = availableToAdd.filter(m => !search.trim() || m.name.toLowerCase().includes(search.toLowerCase()))

  async function handleAdd(member: TeamMember) {
    setMembers(cur => [...cur, member])
    setPickerOpen(false)
    setSearch('')
    const result = await addProjectMember(projectId, member.id)
    if ('error' in result) {
      setMembers(cur => cur.filter(m => m.id !== member.id))
      toast.error(result.error)
      return
    }
    toast.success(`${member.name} added to the project`)
  }

  async function handleRemove(member: TeamMember) {
    const prev = members
    setMembers(cur => cur.filter(m => m.id !== member.id))
    const result = await removeProjectMember(projectId, member.id)
    if ('error' in result) {
      setMembers(prev)
      toast.error(result.error)
      return
    }
    toast.success(`${member.name} removed from the project`)
  }

  return (
    <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '16px', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Project team</div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            Only people on this project can act on its tickets, and can be assigned to them.
          </div>
        </div>
        <button
          onClick={() => setPickerOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-600)', fontSize: '12px', fontWeight: 500, flexShrink: 0 }}
        >
          <Plus size={13} /> Add
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {members.length === 0 && <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>No one added yet.</span>}
        {members.map(m => (
          <span key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '4px 6px 4px 8px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>
            <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--brand-50)', color: 'var(--brand-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 600 }}>
              {getInitials(m.name)}
            </span>
            {m.name}
            <button onClick={() => handleRemove(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: 0 }}>
              <X size={11} />
            </button>
          </span>
        ))}
      </div>

      <AnimatePresence>
        {pickerOpen && (
          <>
            <div onClick={() => setPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              style={{
                position: 'absolute', top: '46px', right: '16px', width: '220px', zIndex: 50,
                background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '8px',
                boxShadow: '0 8px 20px rgba(0,0,0,0.15)', overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', borderBottom: '0.5px solid var(--border-default)' }}>
                <Search size={12} color="var(--text-tertiary)" />
                <input
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search team…"
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '12px', color: 'var(--text-primary)' }}
                />
              </div>
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {filtered.length === 0 ? (
                  <div style={{ padding: '14px', textAlign: 'center', fontSize: '11px', color: 'var(--text-tertiary)' }}>Everyone's already on this project</div>
                ) : (
                  filtered.map(m => (
                    <button
                      key={m.id}
                      onClick={() => handleAdd(m)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    >
                      <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--brand-50)', color: 'var(--brand-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 500 }}>
                        {getInitials(m.name)}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{m.name}</span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
