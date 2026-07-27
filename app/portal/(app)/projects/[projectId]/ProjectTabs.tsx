'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'

const TABS = [
  { label: 'Overview',   suffix: '' },
  { label: 'Milestones', suffix: '/milestones' },
  { label: 'Decisions',  suffix: '/decisions' },
  { label: 'Documents',  suffix: '/documents' },
]

export default function ProjectTabs({ projectId }: { projectId: string }) {
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
        const href = `/portal/projects/${projectId}${tab.suffix}`
        const isActive = tab.suffix === '' ? pathname === href : pathname.startsWith(href)

        return (
          <Link
            key={tab.label}
            href={href}
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
                layoutId="project-tab-underline"
                style={{ position: 'absolute', left: 0, right: 0, bottom: '-1px', height: '2px', background: '#EA580C' }}
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
          </Link>
        )
      })}
    </div>
  )
}
