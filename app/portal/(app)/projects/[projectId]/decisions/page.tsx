import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSessionProject } from '@/lib/portal/session-guard'
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

export const dynamic = 'force-dynamic'

export default async function PortalDecisionsPage({ params }: { params: { projectId: string } }) {
  const project = await getSessionProject(params.projectId)
  const supabase = createServiceRoleClient()

  const [{ data: decisions }, { data: milestones }, { data: contacts }] = await Promise.all([
    supabase.from('decisions').select('*').eq('project_id', project.id).order('ref_number', { ascending: false }),
    supabase.from('milestones').select('id, title').eq('project_id', project.id).order('sort_order'),
    supabase.from('client_contacts').select('id, name').eq('client_id', project.client_id).eq('is_active', true).is('project_id', null).order('name'),
  ])

  const decisionById: Record<string, { ref_number: number }> = {}
  for (const d of decisions ?? []) {
    decisionById[d.id] = { ref_number: d.ref_number }
  }
  const milestoneTitleById = new Map((milestones ?? []).map(m => [m.id, m.title]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>
        All project decisions · {(decisions ?? []).length} total
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {(decisions ?? []).map(dec => {
          const statusCfg = STATUS_CONFIG[dec.status] ?? STATUS_CONFIG.draft
          const parentDec = dec.parent_id ? decisionById[dec.parent_id] : null
          const stageName = dec.milestone_id ? milestoneTitleById.get(dec.milestone_id) : null
          const canAct = dec.status === 'pending_approval' || dec.status === 'on_hold'

          return (
            <div key={dec.id} style={{
              background: 'var(--bg-primary)',
              border: canAct ? '0.5px solid #D6B97B' : '0.5px solid var(--border-default)',
              borderRadius: '10px', padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  fontSize: '11px', fontWeight: 500, color: '#EA580C', background: 'var(--brand-50)',
                  padding: '3px 8px', borderRadius: '6px', flexShrink: 0, marginTop: '2px', fontFamily: 'monospace',
                }}>
                  {formatDecisionRef(dec.ref_number)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{dec.title}</div>
                      {parentDec && (
                        <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                          Amendment of {formatDecisionRef(parentDec.ref_number)}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '5px', flexShrink: 0, alignItems: 'center' }}>
                      {dec.status === 'amended' && (
                        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'var(--info-bg)', color: 'var(--info-text)', fontWeight: 500 }}>Amended</span>
                      )}
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: statusCfg.bg, color: statusCfg.color, fontWeight: 500 }}>
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {stageName && (
                      <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 500 }}>{stageName}</span>
                    )}
                    {dec.meeting_ref && (
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{dec.meeting_ref}</span>
                    )}
                  </div>

                  {dec.description && (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '5px 0 0', lineHeight: 1.5 }}>{dec.description}</p>
                  )}

                  {dec.status === 'approved' && dec.signed_by_name && (
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--success-text)' }}>
                      <span>✓</span>
                      <span>Approved by {dec.signed_by_name} · {formatDate(dec.signed_at)}</span>
                    </div>
                  )}

                  {dec.status === 'declined' && dec.client_decided_by_name && (
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--danger-text)' }}>
                      <span>✕</span>
                      <span>Declined by {dec.client_decided_by_name} · {formatDate(dec.decided_at)}</span>
                    </div>
                  )}

                  {(dec.client_decision_comment && (dec.status === 'declined' || dec.status === 'on_hold')) && (
                    <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      "{dec.client_decision_comment}"
                    </div>
                  )}

                  {dec.status === 'on_hold' && (
                    <div style={{
                      marginTop: '8px', padding: '7px 10px', background: 'var(--warning-bg)', borderRadius: '7px',
                      fontSize: '12px', color: 'var(--warning-text)',
                    }}>
                      You put this on hold{dec.client_decided_by_name ? ` (${dec.client_decided_by_name})` : ''}. You can approve or decline it whenever you're ready.
                    </div>
                  )}

                  {canAct && (
                    <div style={{ marginTop: '10px' }}>
                      <PortalDecisionActions
                        decisionId={dec.id}
                        contacts={contacts ?? []}
                        canResolveFromHold={dec.status === 'on_hold'}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {(decisions ?? []).length === 0 && (
          <div style={{ padding: '48px 32px', textAlign: 'center', background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', fontSize: '14px', color: 'var(--text-tertiary)' }}>
            No decisions have been recorded yet
          </div>
        )}
      </div>
    </div>
  )
}
