'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { CheckCircle2, XCircle, PauseCircle } from 'lucide-react'
import { decidePortalDecision } from '@/lib/decisions/portal-actions'
import ContactNamePicker, { useRememberedContactName } from '@/app/portal/(app)/tickets/ContactNamePicker'

type Action = 'approve' | 'decline' | 'hold'

const ACTION_COPY: Record<Action, { verb: string; confirmTitle: string; confirmBody: string; irreversible: boolean }> = {
  approve: {
    verb: 'Approve',
    confirmTitle: 'Approve this decision?',
    confirmBody: 'Once approved, this cannot be changed or undone.',
    irreversible: true,
  },
  decline: {
    verb: 'Decline',
    confirmTitle: 'Decline this decision?',
    confirmBody: 'Once declined, this cannot be changed or undone.',
    irreversible: true,
  },
  hold: {
    verb: 'Put on hold',
    confirmTitle: 'Put this decision on hold?',
    confirmBody: "You'll be able to approve or decline it later.",
    irreversible: false,
  },
}

export default function PortalDecisionActions({
  decisionId,
  contacts,
  canResolveFromHold,
}: {
  decisionId: string
  contacts: { id: string; name: string }[]
  canResolveFromHold?: boolean
}) {
  const router = useRouter()
  const [contactName, setContactName] = useRememberedContactName()
  const [open, setOpen] = useState<Action | null>(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  function openModal(action: Action) {
    setComment('')
    setOpen(action)
  }

  function close() {
    if (busy) return
    setOpen(null)
    setComment('')
  }

  async function confirm() {
    if (!open) return
    if (!contactName.trim()) {
      toast.error('Let us know who this is from')
      return
    }
    setBusy(true)
    const result = await decidePortalDecision({ decisionId, action: open, contactName, comment })
    setBusy(false)
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success(`Decision ${open === 'approve' ? 'approved' : open === 'decline' ? 'declined' : 'put on hold'}`)
    setOpen(null)
    setComment('')
    router.refresh()
  }

  const copy = open ? ACTION_COPY[open] : null

  return (
    <>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <button onClick={() => openModal('approve')} style={actionBtnStyle('#3B6D11', 'var(--success-bg)')}>
          <CheckCircle2 size={13} /> Approve
        </button>
        <button onClick={() => openModal('decline')} style={actionBtnStyle('var(--danger-text)', 'var(--danger-bg)')}>
          <XCircle size={13} /> Decline
        </button>
        {!canResolveFromHold && (
          <button onClick={() => openModal('hold')} style={actionBtnStyle('var(--warning-text)', 'var(--warning-bg)')}>
            <PauseCircle size={13} /> Put on hold
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && copy && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}
            onClick={e => { if (e.target === e.currentTarget) close() }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
              style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '24px', width: '420px', maxWidth: '90vw' }}
            >
              <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '6px' }}>{copy.confirmTitle}</div>
              <p style={{ fontSize: '13px', color: copy.irreversible ? 'var(--danger-text)' : 'var(--text-tertiary)', margin: '0 0 16px', lineHeight: 1.5 }}>
                {copy.confirmBody}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <ContactNamePicker contacts={contacts} value={contactName} onChange={setContactName} />
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Comment (optional)
                  </label>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    rows={3}
                    placeholder="Add any notes for the NuAIg team…"
                    style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', padding: '9px 12px', border: '0.5px solid var(--border-medium)', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button onClick={close} disabled={busy} style={{ padding: '8px 16px', borderRadius: '8px', border: '0.5px solid var(--border-medium)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button
                  onClick={confirm}
                  disabled={busy}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: '#fff', opacity: busy ? 0.7 : 1,
                    background: open === 'decline' ? 'var(--danger-text)' : open === 'hold' ? '#BA7517' : 'var(--brand-600)',
                  }}
                >
                  {busy ? 'Saving…' : `Confirm ${copy.verb.toLowerCase()}`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function actionBtnStyle(color: string, bg: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 500,
    padding: '5px 11px', borderRadius: '7px', border: 'none', cursor: 'pointer', color, background: bg,
  }
}
