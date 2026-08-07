'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Logo } from '@/components/Logo'
import { changeClientPassword } from './actions'

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '0.5px solid var(--border-medium)',
  borderRadius: '8px',
  fontSize: '14px',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
}

export default function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }

    setLoading(true)
    const result = await changeClientPassword(currentPassword, newPassword)
    setLoading(false)

    if ('error' in result) {
      setError(result.error)
      toast.error(result.error)
      return
    }

    // changeClientPassword() ends the session server-side (password
    // changes force a logout) — land on the login page, not /portal.
    toast.success('Password updated — sign in with your new password')
    router.push('/')
    router.refresh()
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-tertiary)',
      padding: '24px',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        style={{
          width: '100%',
          maxWidth: '380px',
          background: 'var(--bg-primary)',
          border: '0.5px solid var(--border-default)',
          borderRadius: '16px',
          padding: '36px 32px',
        }}
      >
        <div style={{ marginBottom: '28px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Logo size={32} wordmarkSize={18} />
        </div>

        <h2 style={{ fontSize: '17px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 6px' }}>
          {forced ? 'Set a new password' : 'Change your password'}
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: '0 0 20px', lineHeight: 1.5 }}>
          {forced
            ? 'You\'re signing in with a temporary password. Set a new one to continue.'
            : 'Update the password for this account.'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
              {forced ? 'Temporary password' : 'Current password'}
            </label>
            <input
              type="password"
              required
              autoFocus
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
              New password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
              Confirm new password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              style={inputStyle}
            />
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              style={{
                background: 'var(--danger-bg)',
                border: '0.5px solid #F09595',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '13px',
                color: 'var(--danger-text)',
              }}
            >
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px',
              background: loading ? '#FED7AA' : 'var(--brand-600)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '4px',
              transition: 'background .15s',
            }}
          >
            {loading ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
