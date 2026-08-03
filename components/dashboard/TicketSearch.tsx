'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, CornerDownLeft } from 'lucide-react'
import { searchTickets } from '@/lib/tickets/team-actions'
import { formatTicketRef, ticketClientCode } from '@/lib/utils'
import type { TicketSearchResult } from '@/lib/tickets/team-actions'

/**
 * Universal ticket search — lives in the dashboard header (not the tickets
 * page), reachable from anywhere. Any active team member can find any
 * ticket (migration 038's open SELECT policy), regardless of which
 * projects they're on. Ranking (identifier match before title match, exact
 * before prefix) is done server-side by search_tickets() — migration 039.
 */

// Bolds the first case-insensitive occurrence of `needle` inside `text`.
function Highlight({ text, needle }: { text: string; needle: string }) {
  if (!needle.trim()) return <>{text}</>
  const i = text.toLowerCase().indexOf(needle.trim().toLowerCase())
  if (i === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <strong style={{ fontWeight: 500, color: 'var(--brand-600)' }}>{text.slice(i, i + needle.trim().length)}</strong>
      {text.slice(i + needle.trim().length)}
    </>
  )
}

export default function TicketSearch() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const requestId = useRef(0)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TicketSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setOpen(false)
      setLoading(false)
      return
    }
    setLoading(true)
    const id = ++requestId.current
    const timeout = setTimeout(async () => {
      const data = await searchTickets(query)
      // A slower earlier request can resolve after a newer one — ignore it
      // rather than flashing stale results over the current query's own.
      if (id !== requestId.current) return
      setResults(data)
      setActiveIndex(0)
      setOpen(true)
      setLoading(false)
    }, 150)
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
    inputRef.current?.blur()
    router.push(`/dashboard/tickets/${id}`)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => (i - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const picked = results[activeIndex]
      if (picked) handleSelect(picked.id)
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '220px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
        <Search size={13} color="var(--text-tertiary)" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder="Search tickets…"
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
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, width: '360px', maxHeight: '360px', overflowY: 'auto',
              background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.16)', zIndex: 60,
            }}
          >
            {loading ? (
              <div style={{ padding: '18px', textAlign: 'center', fontSize: '12px', color: 'var(--text-tertiary)' }}>Searching…</div>
            ) : results.length === 0 ? (
              <div style={{ padding: '18px', textAlign: 'center', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                No tickets match "{query.trim()}"
              </div>
            ) : (
              <>
                {results.map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => handleSelect(t.id)}
                    onMouseEnter={() => setActiveIndex(i)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
                      background: i === activeIndex ? 'var(--bg-tertiary)' : 'none', border: 'none',
                      borderBottom: '0.5px solid var(--border-default)', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span style={{
                      fontSize: '11px', fontFamily: 'var(--font-geist-mono, monospace)',
                      flexShrink: 0, background: 'var(--brand-50)', color: 'var(--brand-800)', padding: '2px 6px', borderRadius: '5px',
                    }}>
                      {formatTicketRef(t.ref_number, t.client_slug ? ticketClientCode(t.client_slug) : undefined)}
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Highlight text={t.title} needle={query} />
                    </span>
                    {t.client_name && (
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0, maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.client_name}
                      </span>
                    )}
                  </button>
                ))}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px',
                  fontSize: '10px', color: 'var(--text-tertiary)',
                }}>
                  <CornerDownLeft size={10} /> to open · ↑↓ to navigate
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
