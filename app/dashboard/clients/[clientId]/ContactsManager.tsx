'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { formatDate, getInitials } from '@/lib/utils'
import type { ClientContact } from '@/types'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px',
  border: '0.5px solid var(--border-medium)', borderRadius: '7px',
  fontSize: '13px', color: 'var(--text-primary)', outline: 'none',
  boxSizing: 'border-box', background: 'var(--bg-primary)',
}

export default function ContactsManager({
  clientId,
  contacts,
  formerContacts,
}: {
  clientId: string
  contacts: ClientContact[]
  formerContacts: ClientContact[]
}) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '' })
  const [error, setError] = useState<string | null>(null)

  function setField(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) return
    setSaving(true)
    setError(null)

    const { error: err } = await supabase.from('client_contacts').insert({
      client_id: clientId,
      project_id: null,
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      is_active: true,
    })

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }

    setForm({ name: '', email: '' })
    setShowForm(false)
    setSaving(false)
    router.refresh()
  }

  async function handleRemove(contact: ClientContact) {
    if (!confirm(`Remove ${contact.name} from default contacts? They will no longer receive approval emails for new projects.`)) return
    setRemoving(contact.id)

    await supabase.from('client_contacts').update({
      is_active: false,
      removed_at: new Date().toISOString(),
    }).eq('id', contact.id)

    setRemoving(null)
    router.refresh()
  }

  return (
    <div>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{
          fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          Default contacts
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setForm({ name: '', email: '' }); setError(null) }}
          style={{
            padding: '5px 12px',
            background: showForm ? 'var(--bg-primary)' : '#534AB7',
            color: showForm ? 'var(--text-secondary)' : '#fff',
            border: showForm ? '0.5px solid var(--border-default)' : 'none',
            borderRadius: '7px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
          }}
        >
          {showForm ? 'Cancel' : '+ Add contact'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '16px', marginBottom: '10px' }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Name *</label>
                <input
                  type="text" required autoFocus
                  value={form.name} onChange={e => setField('name', e.target.value)}
                  placeholder="Jane Smith"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Email *</label>
                <input
                  type="email" required
                  value={form.email} onChange={e => setField('email', e.target.value)}
                  placeholder="jane@client.com"
                  style={inputStyle}
                />
              </div>
            </div>

            {error && (
              <div style={{ fontSize: '12px', color: 'var(--danger-text)', background: 'var(--danger-bg)', borderRadius: '6px', padding: '8px 10px' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{ padding: '6px 12px', border: '0.5px solid var(--border-medium)', borderRadius: '7px', fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-primary)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !form.name.trim() || !form.email.trim()}
                style={{
                  padding: '6px 14px',
                  background: saving || !form.name.trim() || !form.email.trim() ? '#AFA9EC' : '#534AB7',
                  color: '#fff', border: 'none', borderRadius: '7px',
                  fontSize: '12px', fontWeight: 500,
                  cursor: saving || !form.name.trim() || !form.email.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Adding…' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active contacts list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {contacts.map(contact => (
          <div
            key={contact.id}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '11px 14px', background: 'var(--bg-primary)',
              border: '0.5px solid var(--border-default)', borderRadius: '10px',
            }}
          >
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%', background: 'var(--brand-50)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 500, color: 'var(--brand-800)', flexShrink: 0,
            }}>
              {getInitials(contact.name)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{contact.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>{contact.email}</div>
            </div>
            <button
              onClick={() => handleRemove(contact)}
              disabled={removing === contact.id}
              style={{
                fontSize: '12px', padding: '4px 10px', borderRadius: '6px',
                border: '0.5px solid var(--border-default)', background: 'var(--bg-primary)',
                color: 'var(--danger-text)', cursor: removing === contact.id ? 'wait' : 'pointer',
              }}
            >
              {removing === contact.id ? '…' : 'Remove'}
            </button>
          </div>
        ))}

        {contacts.length === 0 && !showForm && (
          <div style={{
            padding: '24px', textAlign: 'center', background: 'var(--bg-primary)',
            border: '0.5px solid var(--border-default)', borderRadius: '10px',
            fontSize: '13px', color: 'var(--text-tertiary)',
          }}>
            No contacts added yet
          </div>
        )}
      </div>

      {/* Former contacts */}
      {formerContacts.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div style={{
            fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            marginBottom: '8px',
          }}>
            Former contacts
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {formerContacts.map(contact => (
              <div
                key={contact.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 14px', background: 'var(--bg-secondary)',
                  border: '0.5px solid var(--border-default)', borderRadius: '10px',
                  opacity: 0.7,
                }}
              >
                <div style={{
                  width: '30px', height: '30px', borderRadius: '50%', background: 'var(--bg-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px', fontWeight: 500, color: 'var(--text-tertiary)', flexShrink: 0,
                }}>
                  {getInitials(contact.name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{contact.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    {contact.email}
                    {contact.removed_at && ` · Removed ${formatDate(contact.removed_at)}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
