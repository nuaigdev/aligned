import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSessionProject } from '@/lib/portal/session-guard'
import { formatDate, formatFileSize } from '@/lib/utils'
import PortalDecisionCard from '../decisions/PortalDecisionCard'
import PortalMilestoneActions from './PortalMilestoneActions'

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  not_started:      { label: 'Not started',       bg: 'var(--bg-tertiary)',  color: 'var(--text-tertiary)' },
  in_progress:      { label: 'In progress',       bg: 'var(--info-bg)',      color: 'var(--info-text)' },
  awaiting_signoff: { label: 'Awaiting sign-off', bg: 'var(--warning-bg)',   color: 'var(--warning-text)' },
  completed:        { label: 'Completed',          bg: 'var(--success-bg)',   color: 'var(--success-text)' },
  reopened:         { label: 'Reopened',           bg: 'var(--warning-bg)',   color: 'var(--warning-text)' },
}

const DOT_COLOR: Record<string, string> = {
  completed:        '#3B6D11',
  awaiting_signoff: '#EA580C',
  in_progress:      '#185FA5',
  not_started:      '#B4B2A9',
  reopened:         '#993C1D',
}

const FILE_ICON: Record<string, string> = {
  pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
  ppt: '📑', pptx: '📑', png: '🖼', jpg: '🖼', jpeg: '🖼', gif: '🖼', webp: '🖼', zip: '📦', csv: '📊',
}

export const dynamic = 'force-dynamic'

// Milestones are paused while the product focuses on Ticketing. The real
// page logic lives in PortalMilestonesPageContent below, untouched — this
// default export just redirects instead of rendering it. Swap the body of
// this function back to `return PortalMilestonesPageContent({ params })`
// (and re-add the project layout's tabs) to bring it back.
export default async function PortalMilestonesPage({ params }: { params: { projectId: string } }) {
  redirect(`/portal/projects/${params.projectId}`)
}

async function PortalMilestonesPageContent({ params }: { params: { projectId: string } }) {
  const project = await getSessionProject(params.projectId)
  const supabase = createServiceRoleClient()

  const [{ data: milestones }, { data: decisions }, { data: documents }, { data: contacts }] = await Promise.all([
    supabase.from('milestones').select('*').eq('project_id', project.id).order('sort_order').order('created_at'),
    supabase.from('decisions').select('*').eq('project_id', project.id).order('ref_number', { ascending: false }),
    supabase.from('documents').select('*').eq('project_id', project.id).order('created_at', { ascending: false }),
    supabase.from('client_contacts').select('id, name').eq('client_id', project.client_id).eq('is_active', true).is('project_id', null).order('name'),
  ])

  const milestoneIds = (milestones ?? []).map(m => m.id)
  const { data: milestoneSignoffs } = milestoneIds.length > 0
    ? await supabase
        .from('milestone_signoffs')
        .select('milestone_id, signed_by_name, signed_by_email, signed_at')
        .in('milestone_id', milestoneIds)
    : { data: [] }

  const docsWithUrls = await Promise.all(
    (documents ?? []).map(async doc => {
      let signedUrl: string | null = null
      try {
        const { data } = await supabase.storage.from('project-documents').createSignedUrl(doc.storage_path, 3600)
        signedUrl = data?.signedUrl ?? null
      } catch {
        // Storage may not be configured; gracefully degrade
      }
      return { ...doc, signedUrl }
    })
  )

  const decisionsByMilestone = new Map<string, typeof decisions>()
  const unassignedDecisions: typeof decisions = []
  for (const d of decisions ?? []) {
    if (d.milestone_id) {
      if (!decisionsByMilestone.has(d.milestone_id)) decisionsByMilestone.set(d.milestone_id, [])
      decisionsByMilestone.get(d.milestone_id)!.push(d)
    } else {
      unassignedDecisions.push(d)
    }
  }

  const documentsByMilestone = new Map<string, typeof docsWithUrls>()
  const unassignedDocuments: typeof docsWithUrls = []
  for (const doc of docsWithUrls) {
    if (doc.milestone_id) {
      if (!documentsByMilestone.has(doc.milestone_id)) documentsByMilestone.set(doc.milestone_id, [])
      documentsByMilestone.get(doc.milestone_id)!.push(doc)
    } else {
      unassignedDocuments.push(doc)
    }
  }

  function renderDecisionCard(dec: NonNullable<typeof decisions>[number]) {
    return (
      <PortalDecisionCard key={dec.id} decision={dec} contacts={contacts ?? []} compact />
    )
  }

  function renderDocumentRow(doc: (typeof docsWithUrls)[number]) {
    return (
      <a
        key={doc.id}
        href={doc.signedUrl ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: '8px', textDecoration: 'none' }}
      >
        <span style={{ fontSize: '14px', flexShrink: 0 }}>{FILE_ICON[doc.file_type?.toLowerCase() ?? ''] ?? '📎'}</span>
        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', flexShrink: 0 }}>
          {doc.file_size_bytes ? `${formatFileSize(doc.file_size_bytes)} · ` : ''}{formatDate(doc.created_at)}
        </span>
      </a>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>
        Every stage of this project, and the decisions and files tied to it · {(milestones ?? []).length} stages
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {(milestones ?? []).map((ms, i) => {
          const isLast = i === (milestones ?? []).length - 1
          const isInternal = ms.type === 'internal'
          const isAwaiting = ms.status === 'awaiting_signoff'
          const isCompleted = ms.status === 'completed'

          const signoff = milestoneSignoffs?.find(s => s.milestone_id === ms.id)
          const statusCfg = STATUS_CONFIG[ms.status] ?? STATUS_CONFIG.not_started
          const dotColor = DOT_COLOR[ms.status] ?? '#B4B2A9'
          const titleDisplay = ms.iteration > 1 ? `${ms.title} · Cycle ${ms.iteration}` : ms.title

          const stageDecisions = decisionsByMilestone.get(ms.id) ?? []
          const stageDocuments = documentsByMilestone.get(ms.id) ?? []

          return (
            <div key={ms.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '6px', flexShrink: 0, width: '16px' }}>
                <div style={{
                  width: '12px', height: '12px', borderRadius: '50%', background: dotColor, flexShrink: 0,
                  border: ms.status === 'awaiting_signoff' ? '2px solid #EA580C' : 'none', boxSizing: 'border-box',
                }} />
                {!isLast && <div style={{ width: '1px', flex: 1, minHeight: '20px', background: 'var(--border-default)', marginTop: '3px' }} />}
              </div>

              <div style={{ flex: 1, background: 'var(--bg-primary)', border: isAwaiting ? '0.5px solid #FED7AA' : '0.5px solid var(--border-default)', borderRadius: '10px', padding: '14px 16px', marginBottom: isLast ? '0' : '4px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                    {isInternal ? ms.title : titleDisplay}
                  </div>
                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'var(--brand-50)', color: 'var(--brand-800)', fontWeight: 500 }}>{ms.percentage}%</span>
                    {isInternal && (
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)', fontWeight: 500 }}>Internal</span>
                    )}
                    {ms.type === 'client_gate' && (
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'var(--brand-50)', color: 'var(--brand-800)', fontWeight: 500 }}>Your sign-off</span>
                    )}
                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: statusCfg.bg, color: statusCfg.color, fontWeight: 500 }}>
                      {statusCfg.label}
                    </span>
                  </div>
                </div>

                {!isInternal && (
                  <>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: ms.description ? '5px' : '0' }}>
                      {ms.completed_at ? `Completed ${formatDate(ms.completed_at)}` : ms.due_date ? `Due ${formatDate(ms.due_date)}` : null}
                    </div>

                    {ms.description && (
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.5 }}>{ms.description}</p>
                    )}

                    {isAwaiting && ms.type === 'client_gate' && (
                      <div style={{ marginTop: '10px' }}>
                        <PortalMilestoneActions milestoneId={ms.id} contacts={contacts ?? []} />
                      </div>
                    )}

                    {isCompleted && signoff && (
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--success-text)' }}>
                        <span>✓</span>
                        <span>Signed by {signoff.signed_by_name} · {formatDate(signoff.signed_at)}</span>
                      </div>
                    )}

                    {ms.delay_owner && (
                      <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        {ms.delay_owner === 'client' ? '⚠ Delay · Client side' : '⚠ Delay · Team side'}
                      </div>
                    )}
                  </>
                )}

                {(stageDecisions.length > 0 || stageDocuments.length > 0) && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '0.5px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {stageDecisions.length > 0 && (
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                          Decisions
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {stageDecisions.map(renderDecisionCard)}
                        </div>
                      </div>
                    )}
                    {stageDocuments.length > 0 && (
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                          Documents
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          {stageDocuments.map(renderDocumentRow)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {(milestones ?? []).length === 0 && (
        <div style={{ padding: '48px 32px', textAlign: 'center', background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', fontSize: '14px', color: 'var(--text-tertiary)' }}>
          No stages have been added yet
        </div>
      )}

      {(unassignedDecisions.length > 0 || unassignedDocuments.length > 0) && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>
            Not tied to a stage
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {unassignedDecisions.length > 0 && (
              <div>
                <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Decisions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {unassignedDecisions.map(renderDecisionCard)}
                </div>
              </div>
            )}
            {unassignedDocuments.length > 0 && (
              <div>
                <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Documents</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {unassignedDocuments.map(renderDocumentRow)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
