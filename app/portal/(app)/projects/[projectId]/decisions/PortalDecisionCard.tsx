'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { formatDate, formatDecisionRef } from '@/lib/utils'
import PortalDecisionActions from './PortalDecisionActions'

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  draft:            { label: 'Draft',            bg: 'var(--bg-tertiary)',  color: 'var(--text-tertiary)' },
  pending_approval: { label: 'Awaiting your review', bg: 'var(--warning-bg)',   color: 'var(--warning-text)' },
  approved:         { label: 'Approved',         bg: 'var(--success-bg)',   color: 'var(--success-text)' },
  amended:          { label: 'Amended',          bg: 'var(--info-bg)',      color: 'var(--info-text)' },
  declined:         { label: 'Declined',         bg: 'var(--danger-bg)',    color: 'var(--danger-text)' },
  on_hold:          { label: 'On hold',          bg: 'var(--warning-bg)',   color: 'var(--warning-text)' },
}

interface DecisionRow {
  id: string
  ref_number: number
  title: string
  description: string | null
  status: string
  meeting_ref: string | null
  signed_by_name: string | null
  signed_at: string | null
  client_decision_comment: string | null
  client_decided_by_name: string | null
  decided_at: string | null
}

export default function PortalDecisionCard({
  decision,
  stageName,
  contacts,
  compact = false,
}: {
  decision: DecisionRow
  stageName?: string | null
  contacts: { id: string; name: string }[]
  compact?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = STATUS_CONFIG[decision.status] ?? STATUS_CONFIG.draft
  const canAct = decision.status === 'pending_approval' || decision.status === 'on_hold'
  const hasComment = !!decision.client_decision_comment
  const hasMore = (decision.description && decision.description.length > 140) || hasComment

  return (
    <>
      <div
        style={{
          background: compact ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
          border: canAct ? '0.5px solid #D6B97B' : '0.5px solid var(--border-default)',
          borderRadius: compact ? '8px' : '10px', padding: compact ? '10px 12px' : '14px 16px',
        }}
      >
        <div
          onClick={() => setExpanded(true)}
          style={{ cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontFamily: 'monospace', flexShrink: 0 }}>{formatDecisionRef(decision.ref_number)}</span>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{decision.title}</span>
            </div>
            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: cfg.bg, color: cfg.color, fontWeight: 500, flexShrink: 0 }}>{cfg.label}</span>
          </div>

          {stageName && (
            <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 500, display: 'inline-block', marginTop: '5px' }}>{stageName}</span>
          )}

          {decision.description && (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '5px 0 0', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {decision.description}
            </p>
          )}

          {decision.status === 'approved' && decision.signed_by_name && (
            <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--success-text)' }}>✓ Approved by {decision.signed_by_name} · {formatDate(decision.signed_at)}</div>
          )}
          {decision.status === 'declined' && decision.client_decided_by_name && (
            <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--danger-text)' }}>✕ Declined by {decision.client_decided_by_name} · {formatDate(decision.decided_at)}</div>
          )}
          {decision.status === 'on_hold' && decision.client_decided_by_name && (
            <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--warning-text)' }}>⏸ On hold — {decision.client_decided_by_name} · {formatDate(decision.decided_at)}</div>
          )}

          {hasComment && (
            <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              "{decision.client_decision_comment}"
            </div>
          )}

          {hasMore && (
            <div style={{ marginTop: '6px', fontSize: '11px', color: '#EA580C' }}>View full details →</div>
          )}
        </div>

        {canAct && (
          <div style={{ marginTop: '10px' }} onClick={e => e.stopPropagation()}>
            <PortalDecisionActions decisionId={decision.id} contacts={contacts} canResolveFromHold={decision.status === 'on_hold'} />
          </div>
        )}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70 }}
            onClick={e => { if (e.target === e.currentTarget) setExpanded(false) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
              style={{ background: 'var(--bg-primary)', borderRadius: '12px', padding: '24px', width: '480px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{formatDecisionRef(decision.ref_number)}</div>
                <button onClick={() => setExpanded(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex' }}>
                  <X size={16} />
                </button>
              </div>

              <div style={{ fontSize: '17px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>{decision.title}</div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: cfg.bg, color: cfg.color, fontWeight: 500 }}>{cfg.label}</span>
                {stageName && (
                  <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 500 }}>{stageName}</span>
                )}
                {decision.meeting_ref && <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{decision.meeting_ref}</span>}
              </div>

              {decision.description && (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: '0 0 14px' }}>{decision.description}</p>
              )}

              {decision.status === 'approved' && decision.signed_by_name && (
                <div style={{ padding: '9px 12px', background: 'var(--success-bg)', borderRadius: '8px', fontSize: '12px', color: 'var(--success-text)', marginBottom: '10px' }}>
                  ✓ Approved by {decision.signed_by_name} · {formatDate(decision.signed_at)}
                </div>
              )}
              {decision.status === 'declined' && decision.client_decided_by_name && (
                <div style={{ padding: '9px 12px', background: 'var(--danger-bg)', borderRadius: '8px', fontSize: '12px', color: 'var(--danger-text)', marginBottom: '10px' }}>
                  ✕ Declined by {decision.client_decided_by_name} · {formatDate(decision.decided_at)}
                </div>
              )}
              {decision.status === 'on_hold' && decision.client_decided_by_name && (
                <div style={{ padding: '9px 12px', background: 'var(--warning-bg)', borderRadius: '8px', fontSize: '12px', color: 'var(--warning-text)', marginBottom: '10px' }}>
                  ⏸ On hold by {decision.client_decided_by_name} · {formatDate(decision.decided_at)}
                </div>
              )}

              {decision.client_decision_comment && (
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>Comment</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '10px 12px' }}>
                    {decision.client_decision_comment}
                  </div>
                </div>
              )}

              {canAct && (
                <div style={{ paddingTop: '4px', borderTop: '0.5px solid var(--border-default)', marginTop: '4px' }}>
                  <div style={{ marginTop: '12px' }}>
                    <PortalDecisionActions decisionId={decision.id} contacts={contacts} canResolveFromHold={decision.status === 'on_hold'} />
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
