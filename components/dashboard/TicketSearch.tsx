'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Search } from 'lucide-react'
import { searchTickets } from '@/lib/tickets/team-actions'
import { formatTicketRef, ticketClientCode } from '@/lib/utils'
import type { TicketSearchResult } from '@/lib/tickets/team-actions'

/**
 * Universal ticket search — lives in the dashboard header (not the tickets
 * page), reachable from anywhere. Any active team member can find any
 * ticket (migration 038's open SELECT policy), regardless of which
 * projects they're on.
 */
export default function TicketSearch() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TicketSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    const timeout = setTimeout(async () => {
      const data = await searchTickets(query)
      setResults(data)
      setOpen(true)
      setLoading(false)
    }, 200)
    return () => clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(id: string) {
    setOpen(false)
    setQuery('')
    router.push(`/dashboard/tickets/${id}`)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '200px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
        <Search size={13} color="var(--text-tertiary)" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder="Search…"
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: '12px', color: 'var(--text-primary)', minWidth: 0 }}
        />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '340px', maxHeight: '320px', overflowY: 'auto',
              background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '8px',
              boxShadow: '0 8px 20px rgba(0,0,0,0.15)', zIndex: 60,
            }}
          >
            {loading ? (
              <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-tertiary)' }}>Searching…</div>
            ) : results.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-tertiary)' }}>No tickets found</div>
            ) : (
              results.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleSelect(t.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
                    background: 'none', border: 'none', borderBottom: '0.5px solid var(--border-default)', cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-geist-mono, monospace)', flexShrink: 0 }}>
                    {formatTicketRef(t.ref_number, t.client_slug ? ticketClientCode(t.client_slug) : undefined)}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.title}
                  </span>
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
