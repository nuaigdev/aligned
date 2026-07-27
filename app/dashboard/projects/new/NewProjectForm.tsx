'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Client { id: string; name: string }

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  border: '0.5px solid var(--border-medium)',
  borderRadius: '8px',
  fontSize: '14px',
  color: 'var(--text-primary)',
  outline: 'none',
  boxSizing: 'border-box',
  background: 'var(--bg-primary)',
}

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--text-secondary)',
  display: 'block',
  marginBottom: '5px',
}

export default function NewProjectForm({ defaultClientId }: { defaultClientId?: string }) {
  const router = useRouter()
  const supabase = createBrowserClient()

  const [clients, setClients] = useState<Client[]>([])
  const [name, setName] = useState('')
  const [clientId, setClientId] = useState(defaultClientId ?? '')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('clients')
      .select('id, name')
      .order('name')
      .then(({ data }) => { if (data) setClients(data) })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !clientId) return
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('projects')
      .insert({
        name: name.trim(),
        client_id: clientId,
        description: description.trim() || null,
        started_at: startDate || null,
        planned_end_at: endDate || null,
      })
      .select('id')
      .single()

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    router.push(`/dashboard/projects/${data.id}`)
  }

  const canSubmit = name.trim() && clientId && !loading

  return (
    <div style={{ maxWidth: '520px' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>
          <Link href="/dashboard/projects" style={{ color: '#534AB7', textDecoration: 'none' }}>Projects</Link>
          {' / New'}
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>New project</h1>
      </div>

      <div style={{
        background: 'var(--bg-primary)',
        border: '0.5px solid var(--border-default)',
        borderRadius: '10px',
        padding: '24px',
      }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div>
            <label style={labelStyle}>
              Project name <span style={{ color: 'var(--danger-text)' }}>*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Website Redesign"
              autoFocus
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>
              Client <span style={{ color: 'var(--danger-text)' }}>*</span>
            </label>
            <select
              required
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">Select a client…</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of the project scope…"
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Start date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Target end date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {error && (
            <div style={{
              background: 'var(--danger-bg)',
              border: '0.5px solid #F09595',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '13px',
              color: 'var(--danger-text)',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <Link
              href="/dashboard/projects"
              style={{
                padding: '8px 16px',
                border: '0.5px solid var(--border-medium)',
                borderRadius: '8px',
                fontSize: '13px',
                color: 'var(--text-secondary)',
                textDecoration: 'none',
              }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                padding: '8px 18px',
                background: canSubmit ? '#534AB7' : '#AFA9EC',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              {loading ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
