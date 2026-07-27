import { createServiceRoleClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatDate, maskEmail, calculateProgress } from '@/lib/utils'
import Link from 'next/link'

export default async function PortalPage({ params }: { params: { token: string } }) {
  const supabase = createServiceRoleClient()

  const { data: project } = await supabase
    .from('projects')
    .select('*, clients(name, slug)')
    .eq('portal_token', params.token)
    .single()

  if (!project) notFound()

  const [
    { data: milestones },
    { data: decisions },
    { data: pendingApprovals },
  ] = await Promise.all([
    supabase.from('milestones').select('*').eq('project_id', project.id).order('sort_order'),
    supabase.from('decisions').select('*').eq('project_id', project.id).order('ref_number', { ascending: false }).limit(4),
    supabase.from('approval_links')
      .select('recipient_email, target_type, decisions(title), milestones(title)')
      .eq('project_id', project.id)
      .eq('status', 'pending'),
  ])

  const completed = milestones?.filter(m => m.status === 'completed').length ?? 0
  const total = milestones?.length ?? 0
  const progress = calculateProgress(completed, total)
  const clientName = (project.clients as any)?.name || 'Client'
  const signedDecisions = decisions?.filter(d => d.status === 'approved').length ?? 0

  const PHASES = ['Initiation', 'Requirements', 'Design', 'Development', 'UAT', 'Go-live']

  const MILESTONE_DOT: Record<string, string> = {
    completed:       '#3B6D11',
    awaiting_signoff: '#534AB7',
    in_progress:     '#185FA5',
    not_started:     '#B4B2A9',
    reopened:        '#993C1D',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Pending approvals banner */}
      {(pendingApprovals?.length ?? 0) > 0 && (
        <div style={{
          background: 'var(--brand-50)',
          border: '0.5px solid #AFA9EC',
          borderRadius: '10px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
        }}>
          <div style={{ fontSize: '16px', color: '#534AB7', marginTop: '1px' }}>✉</div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--brand-800)' }}>
              {pendingApprovals!.length} item{pendingApprovals!.length > 1 ? 's' : ''} awaiting your sign-off
            </div>
            <div style={{ fontSize: '12px', color: '#534AB7', marginTop: '3px', lineHeight: 1.5 }}>
              Approval links have been sent to your registered contacts. Please check your email to review and sign. You cannot sign from this page.
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {[
          { label: 'Overall progress', value: `${progress}%` },
          { label: 'Milestones done', value: `${completed} / ${total}` },
          { label: 'Decisions signed', value: signedDecisions },
          { label: 'Awaiting sign-off', value: pendingApprovals?.length ?? 0 },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '12px 14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '3px' }}>{s.label}</div>
            <div style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text-primary)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Project progress</span>
          <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>{progress}%</span>
        </div>
        <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden', marginBottom: '10px' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: '#534AB7', borderRadius: '3px' }} />
        </div>
        <div style={{ display: 'flex', gap: '3px' }}>
          {PHASES.map(phase => {
            const phaseMs = milestones?.filter(m => m.phase === phase) || []
            const phaseDone = phaseMs.every(m => m.status === 'completed') && phaseMs.length > 0
            const phaseActive = phaseMs.some(m => ['in_progress', 'awaiting_signoff'].includes(m.status))
            return (
              <div key={phase} style={{
                flex: 1,
                textAlign: 'center',
                fontSize: '10px',
                padding: '4px 2px',
                borderRadius: '4px',
                background: phaseDone ? 'var(--success-bg)' : phaseActive ? 'var(--brand-50)' : 'var(--bg-tertiary)',
                color: phaseDone ? 'var(--success-text)' : phaseActive ? 'var(--brand-800)' : 'var(--text-tertiary)',
              }}>
                {phase}
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent milestones */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Milestone tracker
          </div>
          <Link href={`/portal/${params.token}/milestones`} style={{ fontSize: '12px', color: '#534AB7', textDecoration: 'none' }}>
            View all →
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {milestones?.slice(0, 5).map((ms, i) => {
            const isGate = ms.type === 'client_gate'
            const isAwaiting = ms.status === 'awaiting_signoff'
            const pending = isAwaiting
              ? pendingApprovals?.filter(a => (a as any).milestones?.title === ms.title)
              : []

            return (
              <div key={ms.id} style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '4px', flexShrink: 0 }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: MILESTONE_DOT[ms.status] || 'var(--text-tertiary)' }} />
                  {i < (milestones.length - 1) && (
                    <div style={{ width: '1px', flex: 1, minHeight: '20px', background: 'var(--border-default)', marginTop: '3px' }} />
                  )}
                </div>
                <div style={{
                  flex: 1,
                  background: 'var(--bg-primary)',
                  border: isAwaiting ? '0.5px solid #AFA9EC' : '0.5px solid var(--border-default)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  marginBottom: '3px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{ms.title}</span>
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
        </div>
      </div>

      {/* Recent decisions */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recent decisions
          </div>
          <Link href={`/portal/${params.token}/decisions`} style={{ fontSize: '12px', color: '#534AB7', textDecoration: 'none' }}>
            View all →
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {decisions?.slice(0, 3).map(dec => (
            <div key={dec.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 12px',
              background: 'var(--bg-primary)',
              border: '0.5px solid var(--border-default)',
              borderRadius: '8px',
            }}>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', minWidth: '44px' }}>
                #D-{String(dec.ref_number).padStart(3, '0')}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{dec.title}</span>
              {dec.status === 'approved' ? (
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'var(--success-bg)', color: 'var(--success-text)', fontWeight: 500 }}>
                  Signed by {dec.signed_by_name}
                </span>
              ) : dec.status === 'pending_approval' ? (
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'var(--warning-bg)', color: 'var(--warning-text)', fontWeight: 500 }}>
                  Pending · check email
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
