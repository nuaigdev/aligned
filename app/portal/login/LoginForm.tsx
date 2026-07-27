'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { loginClient } from './actions'
import { Logo } from '@/components/Logo'

export default function PortalLoginForm() {
  const router = useRouter()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await loginClient(loginId, password)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      toast.error(result.error)
      return
    }

    toast.success('Welcome back')
    router.push('/portal')
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
        <div style={{ marginBottom: '32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Logo size={36} wordmarkSize={20} />
          <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '8px' }}>Client portal</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
              Login ID
            </label>
            <input
              type="text"
              required
              autoFocus
              value={loginId}
              onChange={e => setLoginId(e.target.value)}
              placeholder="e.g. nexus-co"
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '0.5px solid var(--border-medium)',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '0.5px solid var(--border-medium)',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
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
              background: loading ? '#FED7AA' : '#EA580C',
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
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: '20px' }}>
          Don't have a login? Ask your NuAIg contact to set one up.
        </p>
      </motion.div>
    </div>
  )
}
