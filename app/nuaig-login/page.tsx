'use client'

import { useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Ticket, Search, Building2, BellRing, ShieldCheck, Users,
} from 'lucide-react'
import { AuthMarketingPanel, type AuthFeature } from '@/components/AuthMarketingPanel'

const FEATURES: AuthFeature[] = [
  {
    icon: Ticket,
    title: 'Tickets that route themselves',
    body: 'Clients raise issues from the portal; the project’s team triages, assigns, and works each one through to resolution.',
  },
  {
    icon: Building2,
    title: 'A portal your clients respect',
    body: 'A live view of every ticket across their projects — a professional front door instead of an email thread.',
  },
  {
    icon: BellRing,
    title: 'Nothing slips through',
    body: 'Real-time notifications keep your team in the loop the moment a ticket is assigned, commented on, or resolved.',
  },
  {
    icon: Search,
    title: 'Find any ticket in seconds',
    body: 'Search by ticket number or keyword from anywhere in the dashboard — every result one click from the full history.',
  },
  {
    icon: ShieldCheck,
    title: 'A record you can stand behind',
    body: 'Every comment, status change, and reassignment is timestamped and kept — a full history on every ticket, always.',
  },
  {
    icon: Users,
    title: 'The right people, on the right projects',
    body: 'Project teams control who can act on a ticket, while any team member can still find and read one — nothing hidden, nothing crossed.',
  },
]

export default function TeamLoginPage() {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-primary)' }}>
      <AuthMarketingPanel
        heading={<>Every client ticket — tracked,<br />triaged, and closed out.</>}
        description="NuAIg Assist is NuAIg's platform for running client engagements: a ticketing system your clients actually want to use, and a portal that makes NuAIg look as sharp as the work itself."
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
            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Sign in to the NuAIg team dashboard</div>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
                Email
              </label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@nuaig.com"
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
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: '20px' }}>
            Team accounts are created by your admin in Supabase.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
