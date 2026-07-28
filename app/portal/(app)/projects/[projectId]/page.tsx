import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSessionProject } from '@/lib/portal/session-guard'
import { formatDate, maskEmail } from '@/lib/utils'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function PortalProjectOverviewPage({ params }: { params: { projectId: string } }) {
  const project = await getSessionProject(params.projectId)
  const supabase = createServiceRoleClient()

  const [
    { data: milestones },
    { data: decisions },
    { data: pendingApprovals },
    { count: pendingDecisionsCount },
  ] = await Promise.all([
    supabase.from('milestones').select('*').eq('project_id', project.id).order('sort_order'),
    supabase.from('decisions').select('*').eq('project_id', project.id).order('ref_number', { ascending: false }).limit(4),
    // Milestones still use the email/token sign-off flow — decisions don't
    // (migration 030), so this only ever reflects milestone approval links.
    supabase.from('approval_links')
      .select('recipient_email, target_type, milestones(title)')
      .eq('project_id', project.id)
      .eq('status', 'pending'),
    supabase.from('decisions')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', project.id)
      .eq('status', 'pending_approval'),
  ])

  const allMilestones = milestones ?? []
  const completedPct = allMilestones.filter(m => m.status === 'completed').reduce((sum, m) => sum + (m.percentage ?? 0), 0)
  const progress = Math.min(100, completedPct)
  const completedCount = allMilestones.filter(m => m.status === 'completed').length
  const signedDecisions = decisions?.filter(d => d.status === 'approved').length ?? 0
  const awaitingSignoffCount = pendingApprovals?.length ?? 0
  const awaitingDecisionCount = pendingDecisionsCount ?? 0

  const MILESTONE_DOT: Record<string, string> = {
    completed:        '#3B6D11',
    awaiting_signoff: '#EA580C',
    in_progress:      '#185FA5',
    not_started:      '#B4B2A9',
    reopened:         '#993C1D',
  }

  const STAGE_TILE_BG: Record<string, string> = {
    completed:        'var(--success-bg)',
    awaiting_signoff: 'var(--brand-50)',
    in_progress:      'var(--brand-50)',
    not_started:      'var(--bg-primary)',
    reopened:         'var(--warning-bg)',
  }
  const STAGE_TILE_COLOR: Record<string, string> = {
    completed:        'var(--success-text)',
    awaiting_signoff: 'var(--brand-800)',
    in_progress:      'var(--brand-800)',
    not_started:      'var(--text-tertiary)',
    reopened:         'var(--warning-text)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {awaitingSignoffCount > 0 && (
        <div style={{
          background: 'var(--brand-50)', border: '0.5px solid #FED7AA', borderRadius: '10px',
          padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px',
        }}>
          <div style={{ fontSize: '16px', color: '#EA580C', marginTop: '1px' }}>✉</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--brand-800)' }}>
              {awaitingSignoffCount} milestone{awaitingSignoffCount > 1 ? 's' : ''} awaiting your sign-off
            </div>
            <div style={{ fontSize: '12px', color: '#EA580C', marginTop: '3px', lineHeight: 1.5 }}>
              Approval links have been sent to your registered contacts. Please check your email to review and sign. You cannot sign from this page.
            </div>
          </div>
        </div>
      )}

      {awaitingDecisionCount > 0 && (
        <Link
          href={`/portal/projects/${project.id}/decisions`}
          style={{
            background: 'var(--warning-bg)', border: '0.5px solid #D6B97B', borderRadius: '10px',
            padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: '10px', textDecoration: 'none',
          }}
        >
          <div style={{ fontSize: '16px', marginTop: '1px' }}>📋</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--warning-text)' }}>
              {awaitingDecisionCount} decision{awaitingDecisionCount > 1 ? 's' : ''} waiting on your review →
            </div>
            <div style={{ fontSize: '12px', color: 'var(--warning-text)', marginTop: '3px', lineHeight: 1.5 }}>
              Approve, decline, or put it on hold right here — no email needed.
            </div>
          </div>
        </Link>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {[
          { label: 'Overall progress', value: `${progress}%` },
          { label: 'Stages done', value: `${completedCount} / ${allMilestones.length}` },
          { label: 'Decisions signed', value: signedDecisions },
          { label: 'Awaiting you', value: awaitingSignoffCount + awaitingDecisionCount },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '12px 14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '3px' }}>{s.label}</div>
            <div style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Project progress</span>
          <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>{progress}%</span>
        </div>
        <div style={{ height: '6px', background: 'var(--bg-primary)', borderRadius: '3px', overflow: 'hidden', marginBottom: '10px' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: '#EA580C', borderRadius: '3px', transition: 'width .3s' }} />
        </div>
        {allMilestones.length > 0 ? (
          <div style={{ display: 'flex', gap: '3px' }}>
            {allMilestones.map(ms => (
              <div
                key={ms.id}
                title={`${ms.title} · ${ms.percentage}%`}
                style={{
                  flex: Math.max(ms.percentage, 4), textAlign: 'center', fontSize: '10px', padding: '4px 2px', borderRadius: '4px',
                  background: STAGE_TILE_BG[ms.status] ?? 'var(--bg-primary)',
                  color: STAGE_TILE_COLOR[ms.status] ?? 'var(--text-tertiary)',
                  overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                }}
              >
                {ms.title}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>No stages defined yet.</p>
        )}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Stage tracker
          </div>
          <Link href={`/portal/projects/${project.id}/milestones`} style={{ fontSize: '12px', color: '#EA580C', textDecoration: 'none' }}>
            View all →
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {allMilestones.slice(0, 5).map((ms, i) => {
            const isGate = ms.type === 'client_gate'
            const isAwaiting = ms.status === 'awaiting_signoff'
            const pending = isAwaiting
              ? pendingApprovals?.filter(a => (a as any).milestones?.title === ms.title)
              : []

            return (
              <div key={ms.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '4px', flexShrink: 0 }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: MILESTONE_DOT[ms.status] || 'var(--text-tertiary)' }} />
                  {i < (allMilestones.length - 1) && (
                    <div style={{ width: '1px', flex: 1, minHeight: '20px', background: 'var(--border-default)', marginTop: '3px' }} />
                  )}
                </div>
                <div style={{
                  flex: 1, background: 'var(--bg-primary)',
                  border: isAwaiting ? '0.5px solid #FED7AA' : '0.5px solid var(--border-default)',
                  borderRadius: '8px', padding: '8px 12px', marginBottom: '3px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{ms.title}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{ms.percentage}%</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      {ms.completed_at ? formatDate(ms.completed_at) : ms.due_date ? `Due ${formatDate(ms.due_date)}` : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '5px', marginTop: '5px', flexWrap: 'wrap' }}>
                    {ms.status === 'completed' && (
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'var(--success-bg)', color: 'var(--success-text)', fontWeight: 500 }}>Completed</span>
                    )}
                    {isAwaiting && (
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'var(--warning-bg)', color: 'var(--warning-text)', fontWeight: 500 }}>Awaiting signature · check email</span>
                    )}
                    {ms.status === 'not_started' && (
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', fontWeight: 500 }}>Not started</span>
                    )}
                    {ms.type === 'internal' && (
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', fontWeight: 500 }}>Internal</span>
                    )}
                    {isGate && (
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'var(--brand-50)', color: 'var(--brand-800)', fontWeight: 500 }}>Your sign-off</span>
                    )}
                  </div>
                  {isAwaiting && pending && pending.length > 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--warning-text)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      ✉ Sent to {maskEmail(pending[0].recipient_email)} · Check your email
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {allMilestones.length === 0 && (
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>No stages have been added yet.</p>
          )}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recent decisions
          </div>
          <Link href={`/portal/projects/${project.id}/decisions`} style={{ fontSize: '12px', color: '#EA580C', textDecoration: 'none' }}>
            View all →
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {decisions?.slice(0, 3).map(dec => (
            <Link
              key={dec.id}
              href={`/portal/projects/${project.id}/decisions`}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px',
                background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '8px', textDecoration: 'none',
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', minWidth: '44px' }}>
                #D-{String(dec.ref_number).padStart(3, '0')}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{dec.title}</span>
              {dec.status === 'approved' ? (
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'var(--success-bg)', color: 'var(--success-text)', fontWeight: 500 }}>
                  Approved
                </span>
              ) : dec.status === 'declined' ? (
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'var(--danger-bg)', color: 'var(--danger-text)', fontWeight: 500 }}>
                  Declined
                </span>
              ) : dec.status === 'on_hold' ? (
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'var(--warning-bg)', color: 'var(--warning-text)', fontWeight: 500 }}>
                  On hold
                </span>
              ) : dec.status === 'pending_approval' ? (
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'var(--warning-bg)', color: 'var(--warning-text)', fontWeight: 500 }}>
                  Awaiting your review
                </span>
              ) : null}
            </Link>
          ))}
          {(decisions ?? []).length === 0 && (
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>No decisions recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
