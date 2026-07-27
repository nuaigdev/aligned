import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import MilestonesPanel from './MilestonesPanel'
import type { Milestone } from '@/types'

export default async function MilestonesPage({ params }: { params: { projectId: string } }) {
  const supabase = createSupabaseServerClient()

  const [{ data: project }, { data: milestones }] = await Promise.all([
    supabase.from('projects').select('id, name, client_id, clients(name)').eq('id', params.projectId).single(),
    supabase.from('milestones').select('*').eq('project_id', params.projectId).order('sort_order').order('created_at'),
  ])

  if (!project) notFound()

  const { data: contacts } = await supabase
    .from('client_contacts')
    .select('id, name, email')
    .eq('client_id', (project as any).client_id)
    .eq('is_active', true)
    .order('name')

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', color: '#888780', marginBottom: '6px' }}>
          <Link href="/dashboard/projects" style={{ color: '#EA580C', textDecoration: 'none' }}>Projects</Link>
          {' / '}
          <Link href={`/dashboard/projects/${params.projectId}`} style={{ color: '#EA580C', textDecoration: 'none' }}>
            {project.name}
          </Link>
          {' / Milestones'}
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1a1918', margin: 0 }}>Milestones</h1>
        <p style={{ fontSize: '13px', color: '#888780', marginTop: '4px' }}>
          {(project.clients as any)?.name}
        </p>
      </div>

      <MilestonesPanel
        projectId={params.projectId}
        initialMilestones={(milestones ?? []) as Milestone[]}
        contacts={(contacts ?? []) as Array<{ id: string; name: string; email: string }>}
      />
    </div>
  )
}
