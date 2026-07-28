'use client'

import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

export function Dot({ color }: { color: string }) {
  return <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
}

export function PillTrigger({ color, bg, label, chevron = true }: { color: string; bg: string; label: string; chevron?: boolean }) {
  return (
    <span style={{
      display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 500, textTransform: 'capitalize',
      padding: '4px 9px', borderRadius: '7px', background: bg, color, cursor: 'pointer',
    }}>
      <Dot color={color} /> {label} {chevron && <ChevronDown size={11} style={{ opacity: 0.6 }} />}
    </span>
  )
}

export function QuickDropdown({
  open, onToggle, trigger, children,
}: {
  open: boolean
  onToggle: () => void
  trigger: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div style={{ position: 'relative' }}>
      <div onClick={e => { e.preventDefault(); e.stopPropagation(); onToggle() }}>{trigger}</div>
      {open && (
        <>
          <div onClick={e => { e.preventDefault(); e.stopPropagation(); onToggle() }} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.12 }}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', top: 'calc(100% + 4px)', right: 0, minWidth: '160px', zIndex: 50,
              background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '8px',
              boxShadow: '0 8px 20px rgba(0,0,0,0.15)', overflow: 'hidden', padding: '4px',
            }}
          >
            {children}
          </motion.div>
        </>
      )}
    </div>
  )
}

export function DropdownItem({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={e => { e.preventDefault(); e.stopPropagation(); onClick() }}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 9px', borderRadius: '6px',
        background: active ? 'var(--bg-tertiary)' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        fontSize: '12px', color: 'var(--text-primary)', textTransform: 'capitalize',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-tertiary)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}
