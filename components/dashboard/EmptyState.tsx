import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  actionHref?: string
}

/** Server-Component-safe — see StatCard.tsx for why that matters here. */
export function EmptyState({ icon: Icon, title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div
      className="animate-in"
      style={{
        padding: '48px 32px',
        textAlign: 'center',
        background: 'var(--bg-primary)',
        border: '0.5px dashed var(--border-medium)',
        borderRadius: '12px',
      }}
    >
      <div style={{
        width: '44px', height: '44px', borderRadius: '12px', margin: '0 auto 14px',
        background: 'var(--brand-50)', color: 'var(--brand-800)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={20} />
      </div>
      <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: description ? '4px' : 0 }}>
        {title}
      </div>
      {description && (
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: '0 0 12px', maxWidth: '340px', marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
          {description}
        </p>
      )}
      {actionLabel && actionHref && (
        <Link href={actionHref} style={{ fontSize: '13px', color: 'var(--brand-600)', textDecoration: 'none', fontWeight: 500 }}>
          {actionLabel} →
        </Link>
      )}
    </div>
  )
}
