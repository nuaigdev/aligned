import { createServiceRoleClient } from '@/lib/supabase/server'
import { getSessionProject } from '@/lib/portal/session-guard'
import DocumentsPortalPanel from './DocumentsPortalPanel'

export default async function PortalDocumentsPage({ params }: { params: { projectId: string } }) {
  const project = await getSessionProject(params.projectId)
  const supabase = createServiceRoleClient()

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })

  const clientName = project.clients?.name || 'Client'

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
      <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>
        Shared project files · {docsWithUrls.length} document{docsWithUrls.length !== 1 ? 's' : ''}
      </p>

      {docsWithUrls.length === 0 ? (
        <div style={{ padding: '48px 32px', textAlign: 'center', background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', fontSize: '14px', color: 'var(--text-tertiary)' }}>
          No documents have been shared yet
        </div>
      ) : (
        <DocumentsPortalPanel docs={docsWithUrls} clientName={clientName} />
      )}
    </div>
  )
}
