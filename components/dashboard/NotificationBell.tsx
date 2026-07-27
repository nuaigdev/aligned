'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { formatRelative } from '@/lib/utils'

export default function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Notifications"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '2px', display: 'flex', position: 'relative' }}
      >
        <Bell size={14} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '-3px', right: '-3px', width: '7px', height: '7px', borderRadius: '50%',
            background: 'var(--danger-text)',
          }} />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute', bottom: '32px', left: 0, width: '300px', maxHeight: '360px', overflowY: 'auto',
                background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px',
                boxShadow: '0 12px 28px rgba(0,0,0,0.18)', zIndex: 50,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '0.5px solid var(--border-default)' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EA580C', fontSize: '11px' }}>
                    Mark all read
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--text-tertiary)' }}>Nothing yet</div>
              ) : (
                notifications.map(n => (
                  <Link
                    key={n.id}
                    href={n.ticket_id ? `/dashboard/tickets/${n.ticket_id}` : '/dashboard/tickets'}
                    onClick={() => { if (!n.is_read) markAsRead(n.id); setOpen(false) }}
                    style={{
                      display: 'block', padding: '10px 12px', textDecoration: 'none',
                      borderBottom: '0.5px solid var(--border-default)',
                      background: n.is_read ? 'transparent' : 'var(--brand-50)',
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{n.title}</div>
                    {n.body && <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{n.body}</div>}
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '3px' }}>{formatRelative(n.created_at)}</div>
                  </Link>
                ))
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
