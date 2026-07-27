'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Send } from 'lucide-react'
import { postPortalComment } from '@/lib/tickets/portal-actions'
import { formatDateTime, getInitials } from '@/lib/utils'
import ContactNamePicker, { useRememberedContactName } from '../ContactNamePicker'

interface PortalComment {
  id: string
  body: string
  created_at: string
  created_by_client_name: string | null
  author_name?: string | null
}

export default function PortalTicketComments({
  ticketId,
  initialComments,
  contacts,
}: {
  ticketId: string
  initialComments: PortalComment[]
  contacts: { id: string; name: string }[]
}) {
  const [comments, setComments] = useState(initialComments)
  const [contactName, setContactName] = useRememberedContactName()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit() {
    if (!body.trim()) return toast.error('Write something first')
    if (!contactName.trim()) return toast.error('Let us know who this is from')

    setBusy(true)
    const result = await postPortalComment({ ticket_id: ticketId, body, contact_name: contactName })
    setBusy(false)

    if ('error' in result) {
      toast.error(result.error)
      return
    }

    setComments(cur => [...cur, {
      id: result.id, body, created_at: new Date().toISOString(), created_by_client_name: contactName,
    }])
    setBody('')
  }

  return (
    <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '18px' }}>
      <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '14px' }}>
        Conversation{comments.length > 0 ? ` (${comments.length})` : ''}
      </div>

      {comments.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '12px' }}>No replies yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
          <AnimatePresence initial={false}>
            {comments.map(c => {
              const isClient = !!c.created_by_client_name
              const name = c.created_by_client_name ?? c.author_name ?? 'NuAIg team'
              return (
                <motion.div key={c.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', gap: '10px' }}>
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                    background: isClient ? 'var(--warning-bg)' : 'var(--brand-50)',
                    color: isClient ? 'var(--warning-text)' : 'var(--brand-800)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 500,
                  }}>
                    {getInitials(name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{name}</span>
                      {!isClient && (
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: 'var(--brand-50)', color: 'var(--brand-800)', fontWeight: 500 }}>NuAIg</span>
                      )}
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{formatDateTime(c.created_at)}</span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>{c.body}</p>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      <div style={{ borderTop: comments.length > 0 ? '0.5px solid var(--border-default)' : 'none', paddingTop: comments.length > 0 ? '14px' : 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <ContactNamePicker contacts={contacts} value={contactName} onChange={setContactName} />
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Write a reply…"
          rows={3}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', padding: '9px 12px', border: '0.5px solid var(--border-medium)', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSubmit}
            disabled={busy || !body.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', border: 'none', borderRadius: '8px', background: '#534AB7', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}
          >
            <Send size={13} /> {busy ? 'Sending…' : 'Send reply'}
          </button>
        </div>
      </div>
    </div>
  )
}
