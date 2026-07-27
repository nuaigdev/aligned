import { createServiceRoleClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatDate, maskEmail } from '@/lib/utils'

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  not_started:      { label: 'Not started',       bg: 'var(--bg-tertiary)',  color: 'var(--text-tertiary)' },
  in_progress:      { label: 'In progress',       bg: 'var(--info-bg)',      color: 'var(--info-text)' },
  awaiting_signoff: { label: 'Awaiting sign-off', bg: 'var(--warning-bg)',   color: 'var(--warning-text)' },
  completed:        { label: 'Completed',          bg: 'var(--success-bg)',   color: 'var(--success-text)' },
  reopened:         { label: 'Reopened',           bg: 'var(--warning-bg)',   color: 'var(--warning-text)' },
}

const DOT_COLOR: Record<string, string> = {
  completed:        '#3B6D11',
  awaiting_signoff: '#534AB7',
  in_progress:      '#185FA5',
  not_started:      '#B4B2A9',
  reopened:         '#993C1D',
}

export default async function PortalMilestonesPage({ params }: { params: { token: string } }) {
  const supabase = createServiceRoleClient()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, client_id, clients(name)')
    .eq('portal_token', params.token)
    .single()

  if (!project) notFound()

  const [
    { data: milestones },
    { data: pendingApprovals },
    { data: signoffs },
  ] = await Promise.all([
    supabase
      .from('milestones')
      .select('*')
      .eq('project_id', project.id)
      .order('sort_order')
      .order('created_at'),
    supabase
      .from('approval_links')
      .select('id, target_id, recipient_email, recipient_name')
      .eq('project_id', project.id)
      .eq('target_type', 'milestone')
      .eq('status', 'pending'),
    supabase
      .from('milestone_signoffs')
      .select('milestone_id, signed_by_name, signed_by_email, signed_at')
      .in(
        'milestone_id',
        []
      ),
  ])

  const milestoneIds = (milestones ?? []).map(m => m.id)
  const { data: milestoneSignoffs } = milestoneIds.length > 0
    ? await supabase
        .from('milestone_signoffs')
        .select('milestone_id, signed_by_name, signed_by_email, signed_at')
        .in('milestone_id', milestoneIds)
    : { data: [] }

  const phaseOrder: string[] = []
  const phaseMap: Record<string, typeof milestones> = {}

  for (const m of milestones ?? []) {
    const phase = m.phase || '__none__'
    if (!phaseMap[phase]) {
      phaseMap[phase] = []
      phaseOrder.push(phase)
    }
    phaseMap[phase]!.push(m)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 4px' }}>Milestones</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>
          Full project timeline · {(milestones ?? []).length} milestones
        </p>
      </div>

      {phaseOrder.map(phase => {
        const phaseMilestones = phaseMap[phase] ?? []
        const showHeader = phase !== '__none__'

        return (
          <div key={phase}>
            {showHeader && (
              <div style={{
                fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.07em',
                marginBottom: '10px',
              }}>
                {phase}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {phaseMilestones.map((ms, i) => {
                const isLast = i === phaseMilestones.length - 1
                const isInternal = ms.type === 'internal'
                const isAwaiting = ms.status === 'awaiting_signoff'
                const isCompleted = ms.status === 'completed'

                const pendingLink = pendingApprovals?.find(a => a.target_id === ms.id)
                const signoff = milestoneSignoffs?.find(s => s.milestone_id === ms.id)
                const statusCfg = STATUS_CONFIG[ms.status] ?? STATUS_CONFIG.not_started
                const dotColor = DOT_COLOR[ms.status] ?? '#B4B2A9'

                const titleDisplay = ms.iteration > 1
                  ? `${ms.title} · Cycle ${ms.iteration}`
                  : ms.title

                return (
                  <div key={ms.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    {/* Timeline connector */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '6px', flexShrink: 0, width: '16px' }}>
                      <div style={{
                        width: '12px', height: '12px', borderRadius: '50%',
                        background: dotColor, flexShrink: 0,
                        border: ms.status === 'awaiting_signoff' ? '2px solid #534AB7' : 'none',
                        boxSizing: 'border-box',
                      }} />
                      {!isLast && (
                        <div style={{ width: '1px', flex: 1, minHeight: '24px', background: 'var(--border-default)', marginTop: '3px' }} />
                      )}
                    </div>

                    {/* Card */}
                    <div style={{
                      flex: 1,
                      background: 'var(--bg-primary)',
                      border: isAwaiting ? '0.5px solid #AFA9EC' : '0.5px solid var(--border-default)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      marginBottom: isLast ? '0' : '6px',
                    }}>
                      {/* Title row */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                          {isInternal ? ms.title : titleDisplay}
                        </div>
                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexShrink: 0 }}>
                          {isInternal && (
                            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                              Internal
                            </span>
                          )}
                          {ms.type === 'client_gate' && (
                            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'var(--brand-50)', color: 'var(--brand-800)', fontWeight: 500 }}>
                              Your sign-off
                            </span>
                          )}
                          {ms.type === 'informational' && (
                            <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'var(--info-bg)', color: 'var(--info-text)', fontWeight: 500 }}>
                              Informational
                            </span>
                          )}
                          <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: statusCfg.bg, color: statusCfg.color, fontWeight: 500 }}>
                            {statusCfg.label}
                          </span>
                        </div>
                      </div>

                      {!isInternal && (
                        <>
                          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: ms.description ? '5px' : '0' }}>
                            {ms.completed_at
                              ? `Completed ${formatDate(ms.completed_at)}`
                              : ms.due_date
                              ? `Due ${formatDate(ms.due_date)}`
                              : null}
                            {ms.phase && !showHeader && ` · ${ms.phase}`}
                          </div>

                          {ms.description && (
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.5 }}>
                              {ms.description}
                            </p>
                          )}

                          {isAwaiting && (
                            <div style={{
                              marginTop: '8px',
                              padding: '7px 10px',
                              background: 'var(--warning-bg)',
                              borderRadius: '7px',
                              fontSize: '12px',
                              color: 'var(--warning-text)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}>
                              <span>✉</span>
                              <span>
                                Awaiting signature · check your email
                                {pendingLink && (
                                  <span>
                                    {' '}· Sent to {maskEmail(pendingLink.recipient_email)}
                                  </span>
                                )}
                              </span>
                            </div>
                          )}

                          {isCompleted && signoff && (
                            <div style={{
                              marginTop: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '11px',
                              color: 'var(--success-text)',
                            }}>
                              <span>✓</span>
                              <span>Signed by {signoff.signed_by_name} · {formatDate(signoff.signed_at)}</span>
                            </div>
                          )}

                          {ms.delay_owner && (
                            <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                              {ms.delay_owner === 'client'
                                ? '⚠ Delay · Client side'
                                : '⚠ Delay · Team side'}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {(milestones ?? []).length === 0 && (
        <div style={{
          padding: '48px 32px', textAlign: 'center', background: 'var(--bg-primary)',
          border: '0.5px solid var(--border-default)', borderRadius: '10px',
          fontSize: '14px', color: 'var(--text-tertiary)',
        }}>
          No milestones have been added yet
        </div>
      )}
    </div>
  )
}
