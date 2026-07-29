'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Send, Pencil, Trash2, X, Check, Lock, Eye } from 'lucide-react'
import { getInitials, formatDateTime } from '@/lib/utils'
import { postTicketComment, editTicketComment, deleteTicketComment } from '@/lib/tickets/team-actions'
import { createBrowserClient } from '@/lib/supabase/client'
import type { TicketComment, TeamMember, TicketType } from '@/types'

interface EnrichedComment extends TicketComment {
  author_member?: TeamMember
  mention_members?: TeamMember[]
}

export default function TicketComments({
  ticketId,
  initialComments,
  candidateMentions,
  currentTeamMemberId,
  ticketType,
  canAct = true,
}: {
  ticketId: string
  initialComments: EnrichedComment[]
  candidateMentions: TeamMember[]
  currentTeamMemberId: string
  ticketType: TicketType
  canAct?: boolean
}) {
  const [comments, setComments] = useState(initialComments)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Team members have real Supabase Auth sessions, so unlike the client
  // portal this can use genuine Realtime — new/edited/deleted comments show
  // up live instead of needing a page refresh (migration 026 added
  // ticket_comments to the publication; RLS from migration 010 still governs
  // what this subscriber actually receives).
  useEffect(() => {
    const supabase = createBrowserClient()
    const channel = supabase
      .channel(`ticket-comments:${ticketId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_comments', filter: `ticket_id=eq.${ticketId}` }, payload => {
        const row = payload.new as any
        setComments(cur => {
          if (cur.some(c => c.id === row.id)) return cur
          return [...cur, {
            ...row,
            author_member: row.created_by_team_member_id ? candidateMentions.find(m => m.id === row.created_by_team_member_id) : undefined,
            mention_members: (row.mentioned_team_member_ids ?? []).map((id: string) => candidateMentions.find(m => m.id === id)).filter(Boolean),
          } as EnrichedComment]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ticket_comments', filter: `ticket_id=eq.${ticketId}` }, payload => {
        const row = payload.new as any
        setComments(cur => cur.map(c => (c.id === row.id
          ? { ...c, body: row.body, edited_at: row.edited_at, mentioned_team_member_ids: row.mentioned_team_member_ids, visible_to_client: row.visible_to_client }
          : c)))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'ticket_comments', filter: `ticket_id=eq.${ticketId}` }, payload => {
        const oldRow = payload.old as any
        setComments(cur => cur.filter(c => c.id !== oldRow.id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId])

  async function handlePost(body: string, mentionedIds: string[], visibleToClient: boolean) {
    const result = await postTicketComment(ticketId, body, mentionedIds, visibleToClient)
    if ('error' in result) {
      toast.error(result.error)
      return false
    }
    setComments(cur => [
      ...cur,
      {
        id: result.id,
        ticket_id: ticketId,
        body,
        edited_at: null,
        mentioned_team_member_ids: mentionedIds,
        created_by_team_member_id: currentTeamMemberId,
        created_by_client_name: null,
        visible_to_client: visibleToClient,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author_member: candidateMentions.find(m => m.id === currentTeamMemberId),
        mention_members: candidateMentions.filter(m => mentionedIds.includes(m.id)),
      } as EnrichedComment,
    ])
    return true
  }

  async function handleEdit(id: string, body: string, mentionedIds: string[], visibleToClient: boolean) {
    const result = await editTicketComment(id, body, mentionedIds, visibleToClient)
    if ('error' in result) {
      toast.error(result.error)
      return false
    }
    setComments(cur => cur.map(c => (c.id === id ? { ...c, body, edited_at: new Date().toISOString(), mentioned_team_member_ids: mentionedIds, visible_to_client: visibleToClient } : c)))
    return true
  }

  async function handleDelete(id: string) {
    const prev = comments
    setComments(cur => cur.filter(c => c.id !== id))
    const result = await deleteTicketComment(id)
    if ('error' in result) {
      setComments(prev)
      toast.error(result.error)
    }
  }

  return (
    <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '18px' }}>
      <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '14px' }}>
        Comments{comments.length > 0 ? ` (${comments.length})` : ''}
      </div>

      {ticketType === 'internal' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', borderRadius: '7px', padding: '7px 10px', marginBottom: '12px' }}>
          <Lock size={11} /> Internal ticket — the client can't see this ticket or any comments on it.
        </div>
      )}

      {canAct ? (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
          <Avatar name="You" />
          <div style={{ flex: 1 }}>
            <Composer candidateMentions={candidateMentions} submitLabel="Comment" resetAfterSubmit onSubmit={handlePost} allowClientVisible={ticketType !== 'internal'} />
          </div>
        </div>
      ) : (
        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', borderRadius: '7px', padding: '8px 10px', marginBottom: '18px' }}>
          You're not on this ticket's project, so you can view the conversation but can't comment.
        </div>
      )}

      {comments.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '12px' }}>No comments yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <AnimatePresence initial={false}>
            {comments.map(c => {
              const isEditing = editingId === c.id
              const mine = c.created_by_team_member_id === currentTeamMemberId
              const authorName = c.created_by_client_name ?? c.author_member?.name ?? 'Team member'
              const isClient = !!c.created_by_client_name

              return (
                <motion.div key={c.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', gap: '10px' }}>
                  <Avatar name={authorName} client={isClient} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{authorName}</span>
                      {isClient && (
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: 'var(--brand-50)', color: 'var(--brand-800)', fontWeight: 500 }}>Client</span>
                      )}
                      {!isClient && (
                        c.visible_to_client ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: 'var(--info-bg)', color: 'var(--info-text)', fontWeight: 500 }}>
                            <Eye size={9} /> Visible to client
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                            <Lock size={9} /> Internal
                          </span>
                        )
                      )}
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{formatDateTime(c.created_at)}</span>
                      {c.edited_at && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>edited</span>}
                    </div>

                    {isEditing ? (
                      <Composer
                        candidateMentions={candidateMentions}
                        initialValue={c.body}
                        initialVisibleToClient={c.visible_to_client}
                        submitLabel="Save"
                        allowClientVisible={ticketType !== 'internal'}
                        onCancel={() => setEditingId(null)}
                        onSubmit={async (body, ids, visible) => {
                          const ok = await handleEdit(c.id, body, ids, visible)
                          if (ok) setEditingId(null)
                          return ok
                        }}
                      />
                    ) : (
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>{c.body}</p>
                    )}
                  </div>

                  {!isEditing && mine && (
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
    </div>
  )
}

function Composer({
  candidateMentions,
  initialValue = '',
  initialVisibleToClient = false,
  submitLabel,
  resetAfterSubmit,
  allowClientVisible = true,
  onCancel,
  onSubmit,
}: {
  candidateMentions: TeamMember[]
  initialValue?: string
  initialVisibleToClient?: boolean
  submitLabel: string
  resetAfterSubmit?: boolean
  allowClientVisible?: boolean
  onCancel?: () => void
  onSubmit: (body: string, mentionedIds: string[], visibleToClient: boolean) => Promise<boolean>
}) {
  const [text, setText] = useState(initialValue)
  const [visibleToClient, setVisibleToClient] = useState(allowClientVisible && initialVisibleToClient)
  const [trigger, setTrigger] = useState<{ query: string; start: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  function detectTrigger(value: string, caret: number) {
    const before = value.slice(0, caret)
    const m = before.match(/@([^\s@]*)$/)
    setTrigger(m ? { query: m[1], start: caret - m[1].length - 1 } : null)
  }

  function pickMember(m: TeamMember) {
    if (!trigger) return
    const caret = taRef.current?.selectionStart ?? text.length
    const before = text.slice(0, trigger.start)
    const after = text.slice(caret)
    const inserted = `@${m.name} `
    setText(before + inserted + after)
    setTrigger(null)
  }

  const candidates = trigger
    ? candidateMentions.filter(m => !trigger.query || m.name.toLowerCase().includes(trigger.query.toLowerCase())).slice(0, 6)
    : []

  function mentionedIdsInText() {
    return candidateMentions.filter(m => text.includes(`@${m.name}`)).map(m => m.id)
  }

  async function submit() {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setBusy(true)
    const ok = await onSubmit(trimmed, mentionedIdsInText(), visibleToClient)
    setBusy(false)
    if (ok && resetAfterSubmit) { setText(''); setVisibleToClient(false) }
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Explicit internal-note vs reply-to-client toggle — internal by
          default, so a comment never reaches the client unless someone
          deliberately says so. Not offered at all on an internal ticket —
          there's no client to reply to. */}
      {allowClientVisible && (
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-tertiary)', borderRadius: '7px', padding: '3px', marginBottom: '8px', width: 'fit-content' }}>
          <button
            type="button"
            onClick={() => setVisibleToClient(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 11px', borderRadius: '5px', border: 'none', cursor: 'pointer',
              fontSize: '11px', fontWeight: 500,
              background: !visibleToClient ? 'var(--bg-primary)' : 'transparent',
              color: !visibleToClient ? 'var(--text-primary)' : 'var(--text-tertiary)',
            }}
          >
            <Lock size={11} /> Internal note
          </button>
          <button
            type="button"
            onClick={() => setVisibleToClient(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 11px', borderRadius: '5px', border: 'none', cursor: 'pointer',
              fontSize: '11px', fontWeight: 500,
              background: visibleToClient ? 'var(--info-bg)' : 'transparent',
              color: visibleToClient ? 'var(--info-text)' : 'var(--text-tertiary)',
            }}
          >
            <Eye size={11} /> Reply to client
          </button>
        </div>
      )}
      {visibleToClient && (
        <p style={{ fontSize: '11px', color: 'var(--info-text)', margin: '0 0 8px', lineHeight: 1.4 }}>
          The client will see this comment on their portal and get emailed about it.
        </p>
      )}

      <textarea
        ref={taRef}
        value={text}
        onChange={e => { setText(e.target.value); detectTrigger(e.target.value, e.target.selectionStart ?? e.target.value.length) }}
        placeholder="Write a comment… use @ to mention someone on this client's team."
        rows={2}
        onKeyDown={e => {
          if (trigger && candidates.length > 0 && (e.key === 'Enter' || e.key === 'Tab')) { e.preventDefault(); pickMember(candidates[0]); return }
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit()
          if (e.key === 'Escape') setTrigger(null)
        }}
        style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', padding: '8px 11px', border: '0.5px solid var(--border-medium)', borderRadius: '7px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
      />

      {trigger && candidates.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, top: '100%', marginTop: '2px', background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '8px', boxShadow: '0 8px 20px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
          {candidates.map(m => (
            <button key={m.id} type="button" onMouseDown={e => { e.preventDefault(); pickMember(m) }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <Avatar name={m.name} size={20} />
              <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{m.name}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '6px' }}>
        {onCancel && (
          <button onClick={onCancel} disabled={busy} style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '7px', border: '0.5px solid var(--border-medium)', background: 'var(--bg-primary)', cursor: 'pointer' }}>
            <X size={11} /> Cancel
          </button>
        )}
        <button onClick={submit} disabled={busy || !text.trim()} style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '7px', border: 'none', background: 'var(--brand-600)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', opacity: busy ? 0.7 : 1 }}>
          {submitLabel === 'Save' ? <Check size={12} /> : <Send size={12} />}
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </div>
  )
}

function Avatar({ name, size = 30, client }: { name: string; size?: number; client?: boolean }) {
  return (
    <div style={{
      width: `${size}px`, height: `${size}px`, borderRadius: '50%', flexShrink: 0,
      background: client ? 'var(--warning-bg)' : 'var(--brand-50)',
      color: client ? 'var(--warning-text)' : 'var(--brand-800)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: `${Math.round(size * 0.34)}px`, fontWeight: 500,
    }}>
      {getInitials(name)}
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '4px', display: 'flex',
}
