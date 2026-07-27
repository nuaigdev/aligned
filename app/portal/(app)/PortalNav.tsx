'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'

const TABS = [
  { label: 'Tickets',  href: '/portal/tickets' },
  { label: 'Projects', href: '/portal' },
]

export default function PortalNav() {
  const pathname = usePathname()

  return (
    <div style={{
      background: 'var(--bg-primary)',
      borderBottom: '0.5px solid var(--border-default)',
      padding: '0 24px',
      display: 'flex',
      gap: '0',
    }}>
      {TABS.map(tab => {
        const isActive = tab.href === '/portal'
          ? pathname === '/portal' || pathname.startsWith('/portal/projects')
          : pathname.startsWith(tab.href)

        return (
          <Link
            key={tab.label}
            href={tab.href}
            style={{
              position: 'relative',
              display: 'inline-block',
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: isActive ? 500 : 400,
              color: isActive ? '#EA580C' : 'var(--text-secondary)',
              textDecoration: 'none',
            }}
          >
            {tab.label}
            {isActive && (
              <motion.div
                layoutId="portal-nav-underline"
                style={{
                  position: 'absolute', left: 0, right: 0, bottom: '-1px', height: '2px',
                  background: '#EA580C',
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
          </Link>
        )
      })}
    </div>
  )
}
