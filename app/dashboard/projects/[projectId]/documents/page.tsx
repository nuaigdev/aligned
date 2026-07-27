import { createSupabaseServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import DocumentsPanel from './DocumentsPanel'
import type { Document } from '@/types'

export default async function DocumentsPage({ params }: { params: { projectId: string } }) {
  const supabase = createSupabaseServerClient()

  const [{ data: project }, { data: documents }] = await Promise.all([
    supabase.from('projects').select('id, name, clients(name)').eq('id', params.projectId).single(),
    supabase.from('documents').select('*').eq('project_id', params.projectId).order('created_at', { ascending: false }),
  ])

  if (!project) notFound()

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '12px', color: '#888780', marginBottom: '6px' }}>
          <Link href="/dashboard/projects" style={{ color: '#534AB7', textDecoration: 'none' }}>Projects</Link>
          {' / '}
          <Link href={`/dashboard/projects/${params.projectId}`} style={{ color: '#534AB7', textDecoration: 'none' }}>
            {project.name}
          </Link>
          {' / Documents'}
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1a1918', margin: 0 }}>Documents</h1>
        <p style={{ fontSize: '13px', color: '#888780', marginTop: '4px' }}>
          {(project.clients as any)?.name}
        </p>
      </div>

      <DocumentsPanel projectId={params.projectId} initialDocuments={(documents ?? []) as Document[]} />
    </div>
  )
}
