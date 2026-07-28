import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  accent?: string
  href?: string
  delayMs?: number
}

/**
 * Server-Component-safe by design — no 'use client', no framer-motion.
 * Entrance/hover come from the .animate-in / .hover-card CSS classes
 * (globals.css) so stat rows stay pure server-rendered HTML even when
 * animated, which is what keeps this cheap with many cards on screen.
 */
export function StatCard({ icon: Icon, label, value, accent = '#EA580C', href, delayMs = 0 }: StatCardProps) {
  const inner = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '13px' }}>
      <div style={{
        width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
        background: `${accent}18`, color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '21px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.15 }}>{value}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </div>
      </div>
    </div>
  )

  const style: React.CSSProperties = {
    display: 'block',
    background: 'var(--bg-primary)',
    border: '0.5px solid var(--border-default)',
    borderRadius: '12px',
    padding: '15px 16px',
    textDecoration: 'none',
    animationDelay: `${delayMs}ms`,
  }

  if (href) {
    return (
      <Link href={href} className="hover-card animate-in" style={style}>
        {inner}
      </Link>
    )
  }

  return (
    <div className="animate-in" style={style}>
      {inner}
    </div>
  )
}
