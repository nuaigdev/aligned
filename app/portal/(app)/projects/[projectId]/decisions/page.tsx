import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSessionProject } from '@/lib/portal/session-guard'
import PortalDecisionCard from './PortalDecisionCard'

export const dynamic = 'force-dynamic'

export default async function PortalDecisionsPage({ params }: { params: { projectId: string } }) {
  const project = await getSessionProject(params.projectId)
  const supabase = createServiceRoleClient()

  const [{ data: decisions }, { data: milestones }, { data: contacts }] = await Promise.all([
    supabase.from('decisions').select('*').eq('project_id', project.id).order('ref_number', { ascending: false }),
    supabase.from('milestones').select('id, title').eq('project_id', project.id).order('sort_order'),
    supabase.from('client_contacts').select('id, name').eq('client_id', project.client_id).eq('is_active', true).is('project_id', null).order('name'),
  ])

  const milestoneTitleById = new Map((milestones ?? []).map(m => [m.id, m.title]))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>
        All project decisions · {(decisions ?? []).length} total
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {(decisions ?? []).map(dec => (
          <PortalDecisionCard
            key={dec.id}
            decision={dec}
            stageName={dec.milestone_id ? milestoneTitleById.get(dec.milestone_id) : null}
            contacts={contacts ?? []}
          />
        ))}

        {(decisions ?? []).length === 0 && (
          <div style={{ padding: '48px 32px', textAlign: 'center', background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', fontSize: '14px', color: 'var(--text-tertiary)' }}>
            No decisions have been recorded yet
          </div>
        )}
      </div>
    </div>
  )
}
