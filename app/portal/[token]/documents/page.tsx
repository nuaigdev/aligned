import { createServiceRoleClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import DocumentsPortalPanel from './DocumentsPortalPanel'

export default async function PortalDocumentsPage({ params }: { params: { token: string } }) {
  const supabase = createServiceRoleClient()

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, clients(name)')
    .eq('portal_token', params.token)
    .single()

  if (!project) notFound()

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })

  const clientName = (project.clients as any)?.name || 'Client'

  // Generate signed URLs server-side
  const docsWithUrls = await Promise.all(
    (documents ?? []).map(async doc => {
      let signedUrl: string | null = null
      try {
        const { data } = await supabase.storage
          .from('project-documents')
          .createSignedUrl(doc.storage_path, 3600)
        signedUrl = data?.signedUrl ?? null
      } catch {
        // Storage may not be configured; gracefully degrade
      }
      return {
        id: doc.id,
        name: doc.name,
        file_type: doc.file_type,
        file_size_bytes: doc.file_size_bytes,
        phase: doc.phase,
        shared_by: doc.shared_by as 'team' | 'client',
        created_at: doc.created_at,
        signedUrl,
      }
    })
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1a1918', margin: '0 0 4px' }}>Documents</h1>
        <p style={{ fontSize: '13px', color: '#888780', margin: 0 }}>
          Shared project files · {docsWithUrls.length} document{docsWithUrls.length !== 1 ? 's' : ''}
        </p>
      </div>

      {docsWithUrls.length === 0 ? (
        <div style={{
          padding: '48px 32px', textAlign: 'center', background: '#fff',
          border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '10px',
          fontSize: '14px', color: '#888780',
        }}>
          No documents have been shared yet
        </div>
      ) : (
        <DocumentsPortalPanel docs={docsWithUrls} clientName={clientName} />
      )}
    </div>
  )
}
