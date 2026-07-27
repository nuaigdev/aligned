'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Copy, Check, KeyRound } from 'lucide-react'
import { setClientManager, issueClientCredentials, revokeClientCredentials } from '@/lib/clients/access-actions'
import { formatDateTime } from '@/lib/utils'
import type { TeamMember } from '@/types'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px', border: '0.5px solid var(--border-medium)', borderRadius: '7px',
  fontSize: '13px', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', background: 'var(--bg-primary)',
}

export default function ClientAccessManager({
  clientId,
  managers,
  currentManagerId,
  loginId: initialLoginId,
  mustChangePassword,
  lastLoginAt,
}: {
  clientId: string
  managers: TeamMember[]
  currentManagerId: string | null
  loginId: string | null
  mustChangePassword: boolean
  lastLoginAt: string | null
}) {
  const [managerId, setManagerId] = useState(currentManagerId ?? '')
  const [loginId, setLoginId] = useState(initialLoginId ?? '')
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  async function handleManagerChange(value: string) {
    setManagerId(value)
    const result = await setClientManager(clientId, value || null)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success('Manager updated')
  }

  async function handleIssue() {
    if (!loginId.trim()) return toast.error('Choose a login ID first')
    setBusy(true)
    const result = await issueClientCredentials(clientId, loginId)
    setBusy(false)

    if ('error' in result) {
      toast.error(result.error)
      return
    }
    setRevealedPassword(result.password)
    toast.success(initialLoginId ? 'Password reset' : 'Login created')
  }

  async function handleRevoke() {
    if (!confirm('Revoke this client\'s login? They will be signed out immediately.')) return
    setBusy(true)
    const result = await revokeClientCredentials(clientId)
    setBusy(false)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    setLoginId('')
    setRevealedPassword(null)
    toast.success('Login revoked')
  }

  async function copyPassword() {
    if (!revealedPassword) return
    await navigator.clipboard.writeText(revealedPassword)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '18px' }}>
      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '14px' }}>Manager &amp; portal access</div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Assigned Manager</label>
        <select value={managerId} onChange={e => handleManagerChange(e.target.value)} style={inputStyle}>
          <option value="">No manager assigned</option>
          {managers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
        </select>
        <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '5px' }}>
          Tickets from this client route to their Manager, who assigns them to their team.
        </p>
      </div>

      <div style={{ borderTop: '0.5px solid var(--border-default)', paddingTop: '14px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '8px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Login ID</label>
            <input value={loginId} onChange={e => setLoginId(e.target.value)} placeholder="e.g. nexus-co" style={inputStyle} />
          </div>
          <button
            onClick={handleIssue}
            disabled={busy}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', border: 'none', borderRadius: '7px', background: '#EA580C', color: '#fff', fontSize: '12px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            <KeyRound size={12} /> {initialLoginId ? 'Reset password' : 'Create login'}
          </button>
        </div>

        {initialLoginId && (
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
            {lastLoginAt ? `Last signed in ${formatDateTime(lastLoginAt)}` : 'Never signed in yet'}
            {mustChangePassword && ' · Must change password on next login'}
            <button onClick={handleRevoke} disabled={busy} style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'var(--danger-text)', cursor: 'pointer', fontSize: '11px', padding: 0 }}>
              Revoke access
            </button>
          </div>
        )}

        <AnimatePresence>
          {revealedPassword && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ background: 'var(--warning-bg)', borderRadius: '8px', padding: '10px 12px', marginTop: '4px' }}
            >
              <div style={{ fontSize: '11px', color: 'var(--warning-text)', marginBottom: '4px' }}>
                One-time password — share this with the client now, it won't be shown again
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <code style={{ flex: 1, fontSize: '14px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{revealedPassword}</code>
                <button onClick={copyPassword} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--success-text)' : 'var(--text-tertiary)', display: 'flex' }}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
