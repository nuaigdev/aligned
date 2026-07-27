'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  approvalToken: string
  recipientName: string
  recipientEmail: string
  clientName: string
  projectName: string
}

export default function SignForm({
  approvalToken,
  recipientName,
  recipientEmail,
  clientName,
  projectName,
}: Props) {
  const router = useRouter()
  const [concernOpen, setConcernOpen] = useState(false)
  const [concernText, setConcernText] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingConcern, setSendingConcern] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSign() {
    setLoading(true)
    setError(null)

    const res = await fetch('/api/approvals/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: approvalToken }),
    })

    if (!res.ok) {
      setError('Something went wrong. Please try again or contact NuAIg.')
      setLoading(false)
      return
    }

    router.refresh()
  }

  async function handleConcernOnly() {
    if (!concernText.trim()) {
      setConcernOpen(true)
      return
    }

    setSendingConcern(true)
    setError(null)

    const res = await fetch('/api/approvals/concern', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: approvalToken, concern: concernText }),
    })

    if (!res.ok) {
      setError('Could not send concern. Please try again.')
      setSendingConcern(false)
      return
    }

    router.refresh()
  }

  return (
    <>
      {/* Disclaimer */}
      <div style={{
        background: '#FAEEDA',
        border: '0.5px solid #EF9F27',
        borderRadius: '10px',
        padding: '12px 14px',
        fontSize: '13px',
        color: '#633806',
        lineHeight: 1.6,
      }}>
        🛡 By signing, you confirm that you are authorised to approve this item on behalf of <strong>{clientName}</strong>.
        This sign-off will be permanently recorded against your name, email address, and the date and time of signing.
        It cannot be undone.
      </div>

      {/* Identity box */}
      <div style={{
        border: '0.5px solid rgba(0,0,0,0.12)',
        borderRadius: '10px',
        padding: '12px 14px',
      }}>
        <div style={{ fontSize: '11px', color: '#888780', marginBottom: '8px' }}>You are signing as</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#E6F1FB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 500,
            color: '#0C447C',
            flexShrink: 0,
          }}>
            {recipientName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1918' }}>{recipientName}</div>
            <div style={{ fontSize: '11px', color: '#888780' }}>{recipientEmail}</div>
          </div>
        </div>
        <div style={{
          fontSize: '11px',
          color: '#888780',
          marginTop: '10px',
          paddingTop: '10px',
          borderTop: '0.5px solid rgba(0,0,0,0.08)',
          lineHeight: 1.5,
        }}>
          This link was sent directly to {recipientEmail}. If you are not {recipientName}, please do not proceed.
        </div>
      </div>

      {/* Concern toggle */}
      <div>
        <button
          onClick={() => setConcernOpen(!concernOpen)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            color: '#888780',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          💬 {concernOpen ? 'Hide concern note' : 'Have a concern before signing? Add a note'}
        </button>

        {concernOpen && (
          <div style={{
            marginTop: '8px',
            background: '#F9F9F8',
            borderRadius: '8px',
            padding: '10px 12px',
          }}>
            <textarea
              rows={3}
              value={concernText}
              onChange={e => setConcernText(e.target.value)}
              placeholder="Describe your concern — this will be sent to the NuAIg team immediately..."
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                fontSize: '13px',
                color: '#1a1918',
                fontFamily: 'inherit',
                resize: 'none',
                outline: 'none',
                lineHeight: 1.5,
              }}
            />
          </div>
        )}
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

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleConcernOnly}
          disabled={sendingConcern}
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            border: '0.5px solid rgba(0,0,0,0.15)',
            background: 'transparent',
            color: '#5F5E5A',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          {sendingConcern ? 'Sending…' : 'Send concern only'}
        </button>
        <button
          onClick={handleSign}
          disabled={loading}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '8px',
            border: 'none',
            background: loading ? '#FED7AA' : '#EA580C',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          {loading ? 'Signing…' : '✓ Confirm & sign'}
        </button>
      </div>
    </>
  )
}
