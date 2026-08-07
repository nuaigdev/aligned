'use client'

import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { Logo } from './Logo'

export interface AuthFeature {
  icon: LucideIcon
  title: string
  body: string
}

/**
 * Shared split-screen marketing panel used by both login surfaces
 * (team /nuaig-login and client /) — same visual treatment, different
 * copy per audience.
 */
export function AuthMarketingPanel({
  heading,
  description,
  features,
}: {
  heading: React.ReactNode
  description: string
  features: AuthFeature[]
}) {
  return (
    <div style={{
      flex: '1 1 55%',
      background: 'linear-gradient(180deg, var(--brand-50) 0%, var(--bg-primary) 100%)',
      borderRight: '0.5px solid var(--border-default)',
      padding: '56px 64px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      maxWidth: '680px',
    }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <Logo size={40} wordmarkSize={22} />

        <h1 style={{
          fontSize: '32px',
          fontWeight: 500,
          color: 'var(--text-primary)',
          lineHeight: 1.25,
          letterSpacing: '-0.02em',
          margin: '32px 0 12px',
        }}>
          {heading}
        </h1>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '480px', marginBottom: '40px' }}>
          {description}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.08 + i * 0.05 }}
              style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}
            >
              <div style={{
                width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
                background: 'var(--brand-100)', color: 'var(--brand-800)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <f.icon size={17} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '2px' }}>
                  {f.title}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: '440px' }}>
                  {f.body}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
