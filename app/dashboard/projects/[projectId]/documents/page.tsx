import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import DocumentsPanel from './DocumentsPanel'
import type { Document } from '@/types'

export const dynamic = 'force-dynamic'

export default async function DocumentsPage({ params }: { params: { projectId: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: project }, { data: documents }, { data: me }, { data: milestones }] = await Promise.all([
    supabase.from('projects').select('id, name, clients(name)').eq('id', params.projectId).single(),
    supabase.from('documents').select('*').eq('project_id', params.projectId).order('created_at', { ascending: false }),
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
          {' / Documents'}
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1a1918', margin: 0 }}>Documents</h1>
        <p style={{ fontSize: '13px', color: '#888780', marginTop: '4px' }}>
          {(project.clients as any)?.name}
        </p>
      </div>

      <DocumentsPanel projectId={params.projectId} initialDocuments={(documents ?? []) as Document[]} milestones={milestones ?? []} canManage={canManage} />
    </div>
  )
}
