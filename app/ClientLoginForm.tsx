'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Ticket, BellRing, Users, ShieldCheck, Search, Building2,
} from 'lucide-react'
import { loginClient } from './login-actions'
import { AuthMarketingPanel, type AuthFeature } from '@/components/AuthMarketingPanel'

const FEATURES: AuthFeature[] = [
  {
    icon: Ticket,
    title: 'Raise a ticket in seconds',
    body: "Tell us what's going on and it's routed straight to the right person on your project team.",
  },
  {
    icon: BellRing,
    title: 'Stay in the loop',
    body: "Know the moment your ticket is picked up, replied to, or resolved — no need to chase an inbox.",
  },
  {
    icon: Users,
    title: 'One portal, your whole team',
    body: 'Everyone on your team signs in with their own email and sees the exact same live view of every ticket.',
  },
  {
    icon: ShieldCheck,
    title: 'A record you can trust',
    body: 'Every reply and status change is timestamped and kept — a full history on every ticket, always.',
  },
  {
    icon: Search,
    title: 'Find anything fast',
    body: 'Every ticket has a short reference number you can search for or quote back to us.',
  },
  {
    icon: Building2,
    title: 'Built around your projects',
    body: 'See tickets grouped by project, alongside the NuAIg team actually working on it.',
  },
]

export default function ClientLoginForm() {
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
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-primary)' }}>
      <AuthMarketingPanel
        heading={<>Every ticket you raise — tracked,<br />answered, and closed out.</>}
        description="NuAIg Assist is where you raise requests for your NuAIg engagement and follow them through to resolution — one place instead of a scattered email thread."
        features={FEATURES}
      />

      {/* Login panel — sticky so it stays put in the viewport while the
          (potentially taller) marketing panel is what actually scrolls;
          the page still has exactly one scrollbar (the body's). */}
      <div style={{
        flex: '1 1 45%',
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          style={{
            width: '100%',
            maxWidth: '380px',
            background: 'var(--bg-primary)',
            border: '0.5px solid var(--border-default)',
            borderRadius: '16px',
            padding: '36px 32px',
            transform: 'translateY(-6%)',
          }}
        >
          <div style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '19px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 4px' }}>
              Welcome back
            </h2>
            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Sign in to your client portal</div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
                Email
              </label>
              <input
                type="email"
                required
                autoFocus
                autoComplete="username"
                value={loginId}
                onChange={e => setLoginId(e.target.value)}
                placeholder="you@company.com"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: '0.5px solid var(--border-medium)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
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
                  boxSizing: 'border-box',
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
    </div>
  )
}
