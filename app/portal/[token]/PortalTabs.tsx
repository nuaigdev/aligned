'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

const TABS = [
  { label: 'Overview',   suffix: '' },
  { label: 'Milestones', suffix: '/milestones' },
  { label: 'Decisions',  suffix: '/decisions' },
  { label: 'Documents',  suffix: '/documents' },
]

export default function PortalTabs({ token }: { token: string }) {
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
        const href = `/portal/${token}${tab.suffix}`
        const isActive = tab.suffix === ''
          ? pathname === href
          : pathname.startsWith(href)

        return (
          <Link
            key={tab.label}
            href={href}
            style={{
              display: 'inline-block',
              padding: '10px 14px',
              fontSize: '13px',
              fontWeight: isActive ? 500 : 400,
              color: isActive ? '#534AB7' : 'var(--text-secondary)',
              textDecoration: 'none',
              borderBottom: isActive ? '2px solid #534AB7' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
