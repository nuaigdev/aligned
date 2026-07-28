'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Check } from 'lucide-react'
import { updateDisplayName, changeOwnPassword } from '@/lib/profile/actions'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '0.5px solid var(--border-medium)', borderRadius: '8px',
  fontSize: '14px', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = { fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '20px',
}

export default function ProfileForm({ name: initialName }: { name: string }) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [savingName, setSavingName] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  async function handleNameSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || savingName) return
    setSavingName(true)
    const result = await updateDisplayName(name.trim())
    setSavingName(false)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success('Display name updated')
    router.refresh()
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (savingPassword) return
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.')
      return
    }
    setSavingPassword(true)
    const result = await changeOwnPassword(currentPassword, newPassword)
    setSavingPassword(false)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success('Password updated')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <form onSubmit={handleNameSubmit} style={cardStyle}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '14px' }}>Display name</div>
        <label style={labelStyle}>Name</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
          <button
            type="submit"
            disabled={savingName || !name.trim() || name.trim() === initialName}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px', padding: '9px 14px', borderRadius: '8px', border: 'none',
              background: 'var(--brand-600)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              opacity: savingName || !name.trim() || name.trim() === initialName ? 0.6 : 1, whiteSpace: 'nowrap',
            }}
          >
            <Check size={13} /> {savingName ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      <form onSubmit={handlePasswordSubmit} style={cardStyle}>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '14px' }}>Change password</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Current password</label>
            <input type="password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>New password</label>
            <input type="password" required minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Confirm new password</label>
            <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px', padding: '9px 16px', borderRadius: '8px', border: 'none',
                background: 'var(--brand-600)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                opacity: savingPassword || !currentPassword || !newPassword || !confirmPassword ? 0.6 : 1,
              }}
            >
              <Check size={13} /> {savingPassword ? 'Saving…' : 'Update password'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
