'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, Copy, Check, Trash2, UserX, UserCheck } from 'lucide-react'
import {
  createTeamMember, updateTeamMemberRole, updateTeamMemberManager, setTeamMemberActive, deleteTeamMember,
} from '@/lib/team/actions'
import { getInitials } from '@/lib/utils'
import type { TeamMember, TeamRole } from '@/types'

const ROLES: TeamRole[] = ['admin', 'manager', 'member']

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px', border: '0.5px solid var(--border-medium)', borderRadius: '7px',
  fontSize: '13px', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', background: 'var(--bg-primary)',
}

export default function TeamManager({
  initialMembers,
  currentUserId,
}: {
  initialMembers: TeamMember[]
  currentUserId: string
}) {
  const router = useRouter()
  const [members, setMembers] = useState(initialMembers)
  const [showInvite, setShowInvite] = useState(false)

  const managers = members.filter(m => m.role === 'admin' || m.role === 'manager')

  async function handleRoleChange(memberId: string, role: TeamRole) {
    setMembers(cur => cur.map(m => (m.id === memberId ? { ...m, role } : m)))
    const result = await updateTeamMemberRole(memberId, role)
    if ('error' in result) {
      toast.error(result.error)
      router.refresh()
    }
  }

  async function handleManagerChange(memberId: string, managerId: string) {
    setMembers(cur => cur.map(m => (m.id === memberId ? { ...m, manager_id: managerId || null } : m)))
    const result = await updateTeamMemberManager(memberId, managerId || null)
    if ('error' in result) {
      toast.error(result.error)
      router.refresh()
    }
  }

  async function handleToggleActive(member: TeamMember) {
    const next = !member.is_active
    setMembers(cur => cur.map(m => (m.id === member.id ? { ...m, is_active: next } : m)))
    const result = await setTeamMemberActive(member.id, next)
    if ('error' in result) {
      toast.error(result.error)
      router.refresh()
    } else {
      toast.success(next ? 'Reactivated' : 'Deactivated')
    }
  }

  async function handleDelete(member: TeamMember) {
    if (!confirm(`Delete ${member.name}'s account? They will lose access immediately. This cannot be undone.`)) return
    const result = await deleteTeamMember(member.id)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    setMembers(cur => cur.filter(m => m.id !== member.id))
    toast.success('Account deleted')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
        <button
          onClick={() => setShowInvite(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: 'none', background: 'var(--brand-600)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
        >
          <Plus size={14} /> Invite team member
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {members.map((member, i) => (
          <div
            key={member.id}
            className="animate-in"
            style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
              background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px',
              opacity: member.is_active ? 1 : 0.55,
              animationDelay: `${Math.min(i, 10) * 30}ms`,
            }}
          >
            <div style={{
              width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
              background: 'var(--brand-50)', color: 'var(--brand-800)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 500,
            }}>
              {getInitials(member.name)}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                {member.name}{member.id === currentUserId && ' (you)'}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{member.email}</div>
            </div>

            <select
              value={member.role}
              onChange={e => handleRoleChange(member.id, e.target.value as TeamRole)}
              disabled={member.id === currentUserId}
              style={{ ...inputStyle, width: '110px', fontSize: '12px', padding: '6px 8px' }}
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            <select
              value={member.manager_id ?? ''}
              onChange={e => handleManagerChange(member.id, e.target.value)}
              style={{ ...inputStyle, width: '150px', fontSize: '12px', padding: '6px 8px' }}
            >
              <option value="">No manager</option>
              {managers.filter(m => m.id !== member.id).map(m => (
                <option key={m.id} value={m.id}>Reports to {m.name}</option>
              ))}
            </select>

            <button
              onClick={() => handleToggleActive(member)}
              disabled={member.id === currentUserId}
              title={member.is_active ? 'Deactivate' : 'Reactivate'}
              style={{ background: 'none', border: 'none', cursor: member.id === currentUserId ? 'not-allowed' : 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: '4px' }}
            >
              {member.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
            </button>

            <button
              onClick={() => handleDelete(member)}
              disabled={member.id === currentUserId}
              title="Delete account"
              style={{ background: 'none', border: 'none', cursor: member.id === currentUserId ? 'not-allowed' : 'pointer', color: 'var(--danger-text)', display: 'flex', padding: '4px' }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showInvite && (
          <InviteModal
            managers={managers}
            onClose={() => setShowInvite(false)}
            onCreated={member => setMembers(cur => [...cur, member].sort((a, b) => a.name.localeCompare(b.name)))}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function InviteModal({
  managers,
  onClose,
  onCreated,
}: {
  managers: TeamMember[]
  onClose: () => void
  onCreated: (member: TeamMember) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamRole>('member')
  const [managerId, setManagerId] = useState('')
  const [saving, setSaving] = useState(false)
  const [revealed, setRevealed] = useState<{ password: string } | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return toast.error('Name and email are required')

    setSaving(true)
    const result = await createTeamMember({ name, email, role, managerId: managerId || null })
    setSaving(false)

    if ('error' in result) {
      toast.error(result.error)
      return
    }

    onCreated({
      id: result.id, name: name.trim(), email: email.trim(), role, manager_id: managerId || null,
      is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
    setRevealed({ password: result.password })
  }

  async function copyPassword() {
    if (!revealed) return
    await navigator.clipboard.writeText(revealed.password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.18 }}
        style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '24px', width: '420px', maxWidth: '90vw' }}
      >
        {revealed ? (
          <div>
            <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>Account created</div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '14px' }}>
              Share this password with {name.trim()} now — it won't be shown again.
            </p>
            <div style={{ background: 'var(--warning-bg)', borderRadius: '8px', padding: '10px 12px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <code style={{ flex: 1, fontSize: '14px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{revealed.password}</code>
                <button onClick={copyPassword} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--success-text)' : 'var(--text-tertiary)', display: 'flex' }}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--brand-600)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '16px' }}>Invite a team member</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Name</label>
                <input autoFocus value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="them@nuaig.ai" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Role</label>
                  <select value={role} onChange={e => setRole(e.target.value as TeamRole)} style={inputStyle}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Reports to</label>
                  <select value={managerId} onChange={e => setManagerId(e.target.value)} style={inputStyle}>
                    <option value="">No manager</option>
                    {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" onClick={onClose} disabled={saving} style={{ padding: '8px 16px', borderRadius: '8px', border: '0.5px solid var(--border-medium)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="submit" disabled={saving} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--brand-600)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Creating…' : 'Create account'}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  )
}
