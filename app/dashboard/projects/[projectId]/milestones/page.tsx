import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import MilestonesPanel from './MilestonesPanel'
import type { Milestone } from '@/types'

export const dynamic = 'force-dynamic'

// Milestones are paused while the product focuses on Ticketing. The real
// page logic lives in MilestonesPageContent below, untouched — this default
// export just redirects instead of rendering it. Swap the body of this
// function back to `return MilestonesPageContent({ params })` (and re-link
// the project hub's nav) to bring it back.
export default async function MilestonesPage({ params }: { params: { projectId: string } }) {
  redirect(`/dashboard/projects/${params.projectId}`)
}

async function MilestonesPageContent({ params }: { params: { projectId: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: project }, { data: milestones }, { data: me }] = await Promise.all([
    supabase.from('projects').select('id, name, client_id, clients(name)').eq('id', params.projectId).single(),
    supabase.from('milestones').select('*').eq('project_id', params.projectId).order('sort_order').order('created_at'),
    user ? supabase.from('team_members').select('role').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
  ])

  if (!project) notFound()
  const canManage = me?.role === 'admin' || me?.role === 'manager'

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
        canManage={canManage}
      />
    </div>
  )
}
