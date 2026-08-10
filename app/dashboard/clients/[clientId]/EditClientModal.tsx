'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Pencil } from 'lucide-react'
import { updateClient } from '@/lib/clients/actions'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '0.5px solid var(--border-medium)', borderRadius: '8px',
  fontSize: '14px', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', background: 'var(--bg-primary)',
}

export default function EditClientModal({ clientId, currentName }: { clientId: string; currentName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(currentName)
  const [busy, setBusy] = useState(false)

  function openModal() {
    setName(currentName)
    setOpen(true)
  }

  async function handleSave() {
    if (!name.trim()) return toast.error('Give the client a name.')
    setBusy(true)
    const result = await updateClient(clientId, name.trim())
    setBusy(false)

    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success('Client updated')
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={openModal}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '7px 12px', borderRadius: '8px', border: '0.5px solid var(--border-medium)',
          background: 'var(--bg-primary)', color: 'var(--text-secondary)',
          fontSize: '13px', fontWeight: 500, cursor: 'pointer', flexShrink: 0,
        }}
      >
        <Pencil size={13} /> Edit
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
              style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '24px', width: '420px', maxWidth: '90vw' }}
            >
              <div style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '16px' }}>
                Edit client
              </div>

              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '5px' }}>
                Client name <span style={{ color: 'var(--danger-text)' }}>*</span>
              </label>
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && name.trim() && !busy) handleSave() }}
                style={inputStyle}
              />
              <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                Existing ticket references (e.g. codes like MATH-017) won't change — those are tied to the client's
                internal short code, not its display name.
              </p>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '18px' }}>
                <button
                  onClick={() => setOpen(false)}
                  disabled={busy}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: '0.5px solid var(--border-medium)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={busy || !name.trim()}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: 'none',
                    background: busy || !name.trim() ? '#FED7AA' : '#EA580C',
                    color: '#fff', fontSize: '13px', fontWeight: 500,
                    cursor: busy || !name.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {busy ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
