'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'aligned_portal_contact_name'

/**
 * Lightweight "posting as" identity — NOT an auth boundary (the client
 * login already is one). This just remembers which named contact is
 * speaking, since the login is shared per company. Persisted in
 * localStorage so returning visitors aren't asked every time.
 */
export function useRememberedContactName(defaultName?: string) {
  const [name, setName] = useState(defaultName ?? '')

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) setName(stored)
  }, [])

  function update(next: string) {
    setName(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }

  return [name, update] as const
}

export default function ContactNamePicker({
  contacts,
  value,
  onChange,
}: {
  contacts: { id: string; name: string }[]
  value: string
  onChange: (name: string) => void
}) {
  const [customMode, setCustomMode] = useState(false)

  const knownMatch = contacts.some(c => c.name === value)

  return (
    <div>
      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Your name *</label>
      {contacts.length > 0 && !customMode ? (
        <select
          value={knownMatch ? value : ''}
          onChange={e => {
            if (e.target.value === '__other__') { setCustomMode(true); onChange(''); return }
            onChange(e.target.value)
          }}
          style={inputStyle}
        >
          <option value="" disabled>Select your name</option>
          {contacts.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          <option value="__other__">Someone else…</option>
        </select>
      ) : (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Your name"
          autoFocus={customMode}
          style={inputStyle}
        />
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '0.5px solid var(--border-medium)', borderRadius: '8px',
  fontSize: '14px', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
}
