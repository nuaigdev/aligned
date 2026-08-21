'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Copy, Check, KeyRound, UserX } from 'lucide-react'
import { setClientManager, createClientLogin, resetClientLoginPassword, revokeClientLogin } from '@/lib/clients/access-actions'
import { formatDateTime, getPortalLoginUrl } from '@/lib/utils'
import type { TeamMember, ClientLogin } from '@/types'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px', border: '0.5px solid var(--border-medium)', borderRadius: '7px',
  fontSize: '13px', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', background: 'var(--bg-primary)',
}

type RevealedCredential = { loginId: string; contactName: string; password: string; emailed: boolean }

export default function ClientAccessManager({
  clientId,
  managers,
  currentManagerId,
  logins: initialLogins,
}: {
  clientId: string
  managers: TeamMember[]
  currentManagerId: string | null
  logins: ClientLogin[]
}) {
  const [managerId, setManagerId] = useState(currentManagerId ?? '')
  const [logins, setLogins] = useState(initialLogins)
  const [contactName, setContactName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [revealed, setRevealed] = useState<RevealedCredential | null>(null)
  const [copiedPassword, setCopiedPassword] = useState(false)
  const [urlCopied, setUrlCopied] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const portalUrl = getPortalLoginUrl()

  async function handleManagerChange(value: string) {
    setManagerId(value)
    const result = await setClientManager(clientId, value || null)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success('Manager updated')
  }

  async function handleCreate() {
    if (!contactName.trim()) return toast.error("Give this login the contact's name")
    if (!newEmail.trim()) return toast.error("Enter the contact's email address first")
    setCreating(true)
    const result = await createClientLogin(clientId, newEmail, contactName)
    setCreating(false)

    if ('error' in result) {
      toast.error(result.error)
      return
    }
    const email = newEmail.trim().toLowerCase()
    setRevealed({ loginId: email, contactName: contactName.trim(), password: result.password, emailed: result.emailed })
    setLogins(prev => [
      ...prev,
      {
        id: `pending-${Date.now()}`,
        client_id: clientId,
        contact_name: contactName.trim(),
        login_id: email,
        must_change_password: true,
        is_active: true,
        last_login_at: null,
        created_at: new Date().toISOString(),
      },
    ])
    setContactName('')
    setNewEmail('')
    toast.success(result.emailed ? `Login created — credentials emailed to ${email}` : 'Login created')
  }

  async function handleReset(login: ClientLogin) {
    setBusyId(login.id)
    const result = await resetClientLoginPassword(login.id)
    setBusyId(null)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    setRevealed({ loginId: login.login_id, contactName: login.contact_name, password: result.password, emailed: result.emailed })
    toast.success(result.emailed ? `Password reset — emailed to ${login.login_id}` : 'Password reset')
  }

  async function handleRevoke(login: ClientLogin) {
    if (!confirm(`Revoke ${login.contact_name}'s login? They will be signed out immediately.`)) return
    setBusyId(login.id)
    const result = await revokeClientLogin(login.id)
    setBusyId(null)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    setLogins(prev => prev.filter(l => l.id !== login.id))
    if (revealed?.loginId === login.login_id) setRevealed(null)
    toast.success('Login revoked')
  }

  async function copyPassword() {
    if (!revealed) return
    await navigator.clipboard.writeText(revealed.password)
    setCopiedPassword(true)
    setTimeout(() => setCopiedPassword(false), 2000)
  }

  async function copyPortalUrl() {
    await navigator.clipboard.writeText(portalUrl)
    setUrlCopied(true)
    setTimeout(() => setUrlCopied(false), 2000)
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
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Portal logins — one per named contact, all seeing the same tickets
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '10px' }}>
          Each person signs in with their email, and every ticket update for this client
          is emailed to that same address. Someone with no login here gets no email.
        </p>

        {logins.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
            {logins.map(login => (
              <div
                key={login.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
                  background: 'var(--bg-tertiary)', borderRadius: '7px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 500, color: 'var(--text-primary)' }}>{login.contact_name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{login.login_id}</div>
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-tertiary)', textAlign: 'right', flexShrink: 0 }}>
                  {login.last_login_at ? `Last in ${formatDateTime(login.last_login_at)}` : 'Never signed in'}
                  {login.must_change_password && <div>Must change password</div>}
                </div>
                <button
                  onClick={() => handleReset(login)}
                  disabled={busyId === login.id}
                  title="Reset password"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', flexShrink: 0 }}
                >
                  <KeyRound size={13} />
                </button>
                <button
                  onClick={() => handleRevoke(login)}
                  disabled={busyId === login.id}
                  title="Revoke login"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-text)', display: 'flex', flexShrink: 0 }}
                >
                  <UserX size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginBottom: '8px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Name</label>
            <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="e.g. Jane Cho" style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Email</label>
            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="e.g. jane@nexus.co" style={inputStyle} />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 12px', border: 'none', borderRadius: '7px', background: '#EA580C', color: '#fff', fontSize: '12px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            <KeyRound size={12} /> Add login
          </button>
        </div>

        <AnimatePresence>
          {revealed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ background: 'var(--warning-bg)', borderRadius: '8px', padding: '10px 12px', marginTop: '4px' }}
            >
              <div style={{ fontSize: '11px', color: 'var(--warning-text)', marginBottom: '4px' }}>
                {revealed.emailed
                  ? `Emailed to ${revealed.contactName} at ${revealed.loginId}. Here it is too, in case they need it read out — it won't be shown again.`
                  : `One-time password for ${revealed.contactName} (${revealed.loginId}) — nothing was emailed, so share this now. It won't be shown again.`}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <code style={{ flex: 1, fontSize: '14px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{revealed.password}</code>
                <button onClick={copyPassword} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copiedPassword ? 'var(--success-text)' : 'var(--text-tertiary)', display: 'flex' }}>
                  {copiedPassword ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--warning-text)', marginBottom: '4px', borderTop: '0.5px solid rgba(0,0,0,0.08)', paddingTop: '8px' }}>
                Portal link — where they log in
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <code style={{ flex: 1, fontSize: '13px', fontFamily: 'monospace', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{portalUrl}</code>
                <button onClick={copyPortalUrl} style={{ background: 'none', border: 'none', cursor: 'pointer', color: urlCopied ? 'var(--success-text)' : 'var(--text-tertiary)', display: 'flex', flexShrink: 0 }}>
                  {urlCopied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
