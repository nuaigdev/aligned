'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { CheckCircle2, MessageCircleWarning } from 'lucide-react'
import { signOffPortalMilestone, raisePortalMilestoneConcern } from '@/lib/milestones/portal-actions'
import ContactNamePicker, { useRememberedContactName } from '@/app/portal/(app)/tickets/ContactNamePicker'

type Action = 'sign' | 'concern'

export default function PortalMilestoneActions({
  milestoneId,
  contacts,
}: {
  milestoneId: string
  contacts: { id: string; name: string }[]
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
    if (open === 'concern' && !comment.trim()) {
      toast.error('Describe your concern')
      return
    }

    setBusy(true)
    const result = open === 'sign'
      ? await signOffPortalMilestone({ milestoneId, contactName })
      : await raisePortalMilestoneConcern({ milestoneId, contactName, comment })
    setBusy(false)

    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success(open === 'sign' ? 'Signed off' : 'Concern sent to the team')
    setOpen(null)
    setComment('')
    router.refresh()
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        <button onClick={() => openModal('sign')} style={actionBtnStyle('#3B6D11', 'var(--success-bg)')}>
          <CheckCircle2 size={13} /> Sign off
        </button>
        <button onClick={() => openModal('concern')} style={actionBtnStyle('var(--warning-text)', 'var(--warning-bg)')}>
          <MessageCircleWarning size={13} /> Raise a concern
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}
            onClick={e => { if (e.target === e.currentTarget) close() }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
              style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '24px', width: '420px', maxWidth: '90vw' }}
            >
              <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '6px' }}>
                {open === 'sign' ? 'Sign off this milestone?' : 'Raise a concern'}
              </div>
              <p style={{ fontSize: '13px', color: open === 'sign' ? 'var(--danger-text)' : 'var(--text-tertiary)', margin: '0 0 16px', lineHeight: 1.5 }}>
                {open === 'sign'
                  ? 'Once signed off, this cannot be undone.'
                  : "This won't block the milestone — it just flags it for the NuAIg team to look into."}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <ContactNamePicker contacts={contacts} value={contactName} onChange={setContactName} />
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    {open === 'sign' ? 'Comment (optional)' : 'What\'s the concern? *'}
                  </label>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    rows={3}
                    placeholder={open === 'sign' ? 'Add any notes for the NuAIg team…' : 'Describe your concern…'}
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
                    background: open === 'sign' ? 'var(--brand-600)' : '#BA7517',
                  }}
                >
                  {busy ? 'Saving…' : open === 'sign' ? 'Confirm sign-off' : 'Send concern'}
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
