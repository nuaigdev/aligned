'use client'

import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Send, Pencil, Trash2, X, Check } from 'lucide-react'
import { postPortalComment, editPortalComment, deletePortalComment } from '@/lib/tickets/portal-actions'
import { formatDateTime, getInitials } from '@/lib/utils'
import ContactNamePicker, { useRememberedContactName } from '../ContactNamePicker'

interface CandidateMember {
  id: string
  name: string
}

interface PortalComment {
  id: string
  body: string
  created_at: string
  edited_at?: string | null
  created_by_client_name: string | null
  author_name?: string | null
}

export default function PortalTicketComments({
  ticketId,
  initialComments,
  contacts,
  candidateMentions,
}: {
  ticketId: string
  initialComments: PortalComment[]
  contacts: { id: string; name: string }[]
  candidateMentions: CandidateMember[]
}) {
  const [comments, setComments] = useState(initialComments)
  const [contactName, setContactName] = useRememberedContactName()
  const [editingId, setEditingId] = useState<string | null>(null)

  async function handleSubmit(body: string, mentionedIds: string[]) {
    if (!contactName.trim()) {
      toast.error('Let us know who this is from')
      return false
    }
    const result = await postPortalComment({ ticket_id: ticketId, body, contact_name: contactName, mentioned_team_member_ids: mentionedIds })
    if ('error' in result) {
      toast.error(result.error)
      return false
    }
    setComments(cur => [...cur, {
      id: result.id, body, created_at: new Date().toISOString(), created_by_client_name: contactName,
    }])
    return true
  }

  async function handleEdit(id: string, body: string) {
    const result = await editPortalComment(id, body)
    if ('error' in result) {
      toast.error(result.error)
      return false
    }
    setComments(cur => cur.map(c => (c.id === id ? { ...c, body, edited_at: new Date().toISOString() } : c)))
    return true
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this reply?')) return
    const prev = comments
    setComments(cur => cur.filter(c => c.id !== id))
    const result = await deletePortalComment(id)
    if ('error' in result) {
      setComments(prev)
      toast.error(result.error)
    }
  }

  return (
    <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '18px' }}>
      <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '14px' }}>
        Conversation{comments.length > 0 ? ` (${comments.length})` : ''}
      </div>

      {comments.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '12px' }}>
          No replies yet — NuAIg will get back to you here.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
          <AnimatePresence initial={false}>
            {comments.map(c => {
              const isClient = !!c.created_by_client_name
              const name = c.created_by_client_name ?? c.author_name ?? 'NuAIg team'
              const isEditing = editingId === c.id
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
                      {c.edited_at && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>edited</span>}
                    </div>

                    {isEditing ? (
                      <InlineEditor
                        initialValue={c.body}
                        onCancel={() => setEditingId(null)}
                        onSubmit={async body => {
                          const ok = await handleEdit(c.id, body)
                          if (ok) setEditingId(null)
                          return ok
                        }}
                      />
                    ) : (
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>{c.body}</p>
                    )}
                  </div>

                  {!isEditing && isClient && (
                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                      <button onClick={() => setEditingId(c.id)} style={iconBtn}><Pencil size={13} /></button>
                      <button onClick={() => handleDelete(c.id)} style={iconBtn}><Trash2 size={13} /></button>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      <div style={{ borderTop: comments.length > 0 ? '0.5px solid var(--border-default)' : 'none', paddingTop: comments.length > 0 ? '14px' : 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <ContactNamePicker contacts={contacts} value={contactName} onChange={setContactName} />
        <Composer candidateMentions={candidateMentions} onSubmit={handleSubmit} />
      </div>
    </div>
  )
}

function Composer({
  candidateMentions,
  onSubmit,
}: {
  candidateMentions: CandidateMember[]
  onSubmit: (body: string, mentionedIds: string[]) => Promise<boolean>
}) {
  const [text, setText] = useState('')
  const [trigger, setTrigger] = useState<{ query: string; start: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  function detectTrigger(value: string, caret: number) {
    const before = value.slice(0, caret)
    const m = before.match(/@([^\s@]*)$/)
    setTrigger(m ? { query: m[1], start: caret - m[1].length - 1 } : null)
  }

  function pickMember(m: CandidateMember) {
    if (!trigger) return
    const caret = taRef.current?.selectionStart ?? text.length
    const before = text.slice(0, trigger.start)
    const after = text.slice(caret)
    setText(before + `@${m.name} ` + after)
    setTrigger(null)
  }

  const candidates = trigger
    ? candidateMentions.filter(m => !trigger.query || m.name.toLowerCase().includes(trigger.query.toLowerCase())).slice(0, 6)
    : []

  function mentionedIdsInText() {
    return candidateMentions.filter(m => text.includes(`@${m.name}`)).map(m => m.id)
  }

  async function submit() {
    if (!text.trim() || busy) return
    setBusy(true)
    const ok = await onSubmit(text.trim(), mentionedIdsInText())
    setBusy(false)
    if (ok) setText('')
  }

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={taRef}
        value={text}
        onChange={e => { setText(e.target.value); detectTrigger(e.target.value, e.target.selectionStart ?? e.target.value.length) }}
        placeholder="Write a reply… use @ to mention someone on your NuAIg team."
        rows={3}
        onKeyDown={e => {
          if (trigger && candidates.length > 0 && (e.key === 'Enter' || e.key === 'Tab')) { e.preventDefault(); pickMember(candidates[0]); return }
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit()
          if (e.key === 'Escape') setTrigger(null)
        }}
        style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', padding: '9px 12px', border: '0.5px solid var(--border-medium)', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      />

      {trigger && candidates.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, bottom: '100%', marginBottom: '2px', background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '8px', boxShadow: '0 8px 20px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
          {candidates.map(m => (
            <button key={m.id} type="button" onMouseDown={e => { e.preventDefault(); pickMember(m) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{m.name}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
        <button
          onClick={submit}
          disabled={busy || !text.trim()}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', border: 'none', borderRadius: '8px', background: 'var(--brand-600)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', opacity: busy ? 0.7 : 1 }}
        >
          <Send size={13} /> {busy ? 'Sending…' : 'Send reply'}
        </button>
      </div>
    </div>
  )
}

function InlineEditor({
  initialValue,
  onCancel,
  onSubmit,
}: {
  initialValue: string
  onCancel: () => void
  onSubmit: (body: string) => Promise<boolean>
}) {
  const [text, setText] = useState(initialValue)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!text.trim() || busy) return
    setBusy(true)
    await onSubmit(text.trim())
    setBusy(false)
  }

  return (
    <div>
      <textarea
        autoFocus
        value={text}
        onChange={e => setText(e.target.value)}
        rows={2}
        style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', padding: '8px 11px', border: '0.5px solid var(--border-medium)', borderRadius: '7px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      />
      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '6px' }}>
        <button onClick={onCancel} disabled={busy} style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '7px', border: '0.5px solid var(--border-medium)', background: 'var(--bg-primary)', cursor: 'pointer' }}>
          <X size={11} /> Cancel
        </button>
        <button onClick={submit} disabled={busy || !text.trim()} style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '7px', border: 'none', background: 'var(--brand-600)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', opacity: busy ? 0.7 : 1 }}>
          <Check size={12} /> {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px', display: 'flex',
}
