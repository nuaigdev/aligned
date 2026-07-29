'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'

// The Projects tab is retired while the product focuses on Ticketing — the
// portal's project drill-down is redirected away (see
// app/portal/(app)/projects/[projectId]/layout.tsx). Re-add
// { label: 'Projects', href: '/portal' } here when re-enabling it.
const TABS = [
  { label: 'Tickets', href: '/portal/tickets' },
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
