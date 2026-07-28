'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Trash2 } from 'lucide-react'

interface Props {
  /** What's being deleted, shown in the confirmation copy. */
  entityLabel: string
  /** The exact string the user must retype to enable the delete button. */
  confirmText: string
  /** Extra warning about what else disappears (cascades), shown verbatim. */
  cascadeWarning?: string
  /**
   * The raw Server Action reference (e.g. `deleteClient`) — passed as-is,
   * NOT wrapped in a new arrow function, so Next.js can serialize it across
   * the server/client boundary. This component calls action(entityId).
   */
  action: (entityId: string) => Promise<{ ok: true } | { error: string }>
  entityId: string
  redirectTo: string
  buttonLabel?: string
}

export default function DeleteConfirmButton({
  entityLabel,
  confirmText,
  cascadeWarning,
  action,
  entityId,
  redirectTo,
  buttonLabel = 'Delete',
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)

  const canConfirm = typed.trim() === confirmText

  async function handleConfirm() {
    if (!canConfirm) return
    setBusy(true)
    const result = await action(entityId)
    setBusy(false)

    if ('error' in result) {
      toast.error(result.error)
      return
    }

    toast.success(`${entityLabel} deleted`)
    setOpen(false)
    router.push(redirectTo)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '7px 14px', borderRadius: '8px', border: '0.5px solid var(--danger-text)',
          background: 'var(--bg-primary)', color: 'var(--danger-text)',
          fontSize: '13px', fontWeight: 500, cursor: 'pointer',
        }}
      >
        <Trash2 size={13} /> {buttonLabel}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
            onClick={e => { if (e.target === e.currentTarget && !busy) setOpen(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.18 }}
              style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '24px', width: '440px', maxWidth: '90vw' }}
            >
              <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Delete {entityLabel}?
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: cascadeWarning ? '8px' : '16px' }}>
                This cannot be undone.
              </p>
              {cascadeWarning && (
                <div style={{
                  background: 'var(--danger-bg)', border: '0.5px solid #F09595', borderRadius: '8px',
                  padding: '10px 12px', fontSize: '12px', color: 'var(--danger-text)', lineHeight: 1.5, marginBottom: '16px',
                }}>
                  {cascadeWarning}
                </div>
              )}

              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
                Type <strong>{confirmText}</strong> to confirm
              </label>
              <input
                autoFocus
                value={typed}
                onChange={e => setTyped(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && canConfirm) handleConfirm() }}
                style={{
                  width: '100%', padding: '9px 12px', border: '0.5px solid var(--border-medium)', borderRadius: '8px',
                  fontSize: '14px', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
                  marginBottom: '18px',
                }}
              />

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '0.5px solid var(--border-medium)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={!canConfirm || busy}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: 'none',
                    background: canConfirm ? 'var(--danger-text)' : 'var(--border-medium)',
                    color: '#fff', fontSize: '13px', fontWeight: 500,
                    cursor: canConfirm && !busy ? 'pointer' : 'not-allowed',
                  }}
                >
                  {busy ? 'Deleting…' : `Delete ${entityLabel}`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
