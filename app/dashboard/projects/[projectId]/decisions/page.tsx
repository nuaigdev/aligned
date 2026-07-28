import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import DecisionsPanel from './DecisionsPanel'
import type { Decision } from '@/types'

export const dynamic = 'force-dynamic'

export default async function DecisionsPage({ params }: { params: { projectId: string } }) {
  const supabase = createSupabaseServerClient()

  const [{ data: project }, { data: decisions }] = await Promise.all([
    supabase.from('projects').select('id, name, client_id, clients(name)').eq('id', params.projectId).single(),
    supabase.from('decisions').select('*').eq('project_id', params.projectId).order('ref_number', { ascending: false }),
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
        contacts={(contacts ?? []) as Array<{ id: string; name: string; email: string }>}
      />
    </div>
  )
}
