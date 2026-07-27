'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import Link from 'next/link'

function toSlug(value: string) {
  return value.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export default function NewClientPage() {
  const router = useRouter()
  const supabase = createBrowserClient()
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('clients')
      .insert({ name: name.trim(), slug: toSlug(name) })
      .select('id')
      .single()

    if (err) {
      setError(err.message.includes('unique') ? 'A client with this name already exists.' : err.message)
      setLoading(false)
      return
    }

    router.push(`/dashboard/clients/${data.id}`)
  }

  return (
    <div style={{ maxWidth: '480px' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', color: '#888780', marginBottom: '6px' }}>
          <Link href="/dashboard/clients" style={{ color: '#EA580C', textDecoration: 'none' }}>Clients</Link>
          {' / New'}
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1a1918', margin: 0 }}>New client</h1>
      </div>

      <div style={{
        background: '#fff',
        border: '0.5px solid rgba(0,0,0,0.1)',
        borderRadius: '10px',
        padding: '24px',
      }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#5F5E5A', display: 'block', marginBottom: '5px' }}>
              Client name <span style={{ color: '#A32D2D' }}>*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Mather"
              autoFocus
              style={{
                width: '100%',
                padding: '9px 12px',
                border: '0.5px solid rgba(0,0,0,0.15)',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#1a1918',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#FCEBEB',
              border: '0.5px solid #F09595',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '13px',
              color: '#A32D2D',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <Link
              href="/dashboard/clients"
              style={{
                padding: '8px 16px',
                border: '0.5px solid rgba(0,0,0,0.15)',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#5F5E5A',
                textDecoration: 'none',
              }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              style={{
                padding: '8px 18px',
                background: loading || !name.trim() ? '#FED7AA' : '#EA580C',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: loading || !name.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Creating…' : 'Create client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
