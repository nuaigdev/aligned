import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import DecisionsPanel from './DecisionsPanel'
import type { Decision } from '@/types'

export const dynamic = 'force-dynamic'

// Decisions are paused while the product focuses on Ticketing. The real
// page logic lives in DecisionsPageContent below, untouched — this default
// export just redirects instead of rendering it. Swap the body of this
// function back to `return DecisionsPageContent({ params })` (and re-link
// the project hub's nav) to bring it back.
export default async function DecisionsPage({ params }: { params: { projectId: string } }) {
  redirect(`/dashboard/projects/${params.projectId}`)
}

async function DecisionsPageContent({ params }: { params: { projectId: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: project }, { data: decisions }, { data: me }, { data: milestones }] = await Promise.all([
    supabase.from('projects').select('id, name, client_id, clients(name)').eq('id', params.projectId).single(),
    supabase.from('decisions').select('*').eq('project_id', params.projectId).order('ref_number', { ascending: false }),
    user ? supabase.from('team_members').select('role').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('milestones').select('id, title').eq('project_id', params.projectId).order('sort_order'),
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
          {' / Decisions'}
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1a1918', margin: 0 }}>Decisions</h1>
        <p style={{ fontSize: '13px', color: '#888780', marginTop: '4px' }}>
          {(project.clients as any)?.name}
        </p>
      </div>

      <DecisionsPanel
        projectId={params.projectId}
        initialDecisions={(decisions ?? []) as Decision[]}
        milestones={milestones ?? []}
        canManage={canManage}
      />
    </div>
  )
}
