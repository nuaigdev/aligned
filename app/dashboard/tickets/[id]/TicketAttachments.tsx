'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { formatFileSize, formatDate } from '@/lib/utils'
import { Paperclip, Download, Trash2, Upload } from 'lucide-react'
import { ImageLightbox, isImageFile } from '@/components/dashboard/ImageLightbox'
import type { Document } from '@/types'

const FILE_ICON: Record<string, string> = {
  pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
  ppt: '📑', pptx: '📑', png: '🖼', jpg: '🖼', jpeg: '🖼', gif: '🖼', zip: '📦', csv: '📊',
}

interface AttachmentDoc extends Document {
  signedUrl?: string | null
}

export default function TicketAttachments({
  ticketId,
  projectId,
  initialDocuments,
  canAct = true,
  canDeleteClientDocs = false,
}: {
  ticketId: string
  projectId: string | null
  initialDocuments: AttachmentDoc[]
  canAct?: boolean
  // Only an admin can remove a client's attachment from the team side
  // (migration 044 enforces this at the RLS layer; this just keeps the
  // button from appearing for everyone else and getting a confusing
  // failure). The client can still remove their own via the portal.
  canDeleteClientDocs?: boolean
}) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null)

  const images = initialDocuments.filter(d => isImageFile(d.file_type))
  const files = initialDocuments.filter(d => !isImageFile(d.file_type))

  async function uploadFile(file: File) {
    setUploading(true)
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `tickets/${ticketId}/${Date.now()}_${safeName}`

    const { error: storageErr } = await supabase.storage
      .from('project-documents')
      .upload(storagePath, file, { cacheControl: '3600', upsert: false })

    if (storageErr) {
      setUploading(false)
      return
    }

    await supabase.from('documents').insert({
      project_id: projectId,
      ticket_id: ticketId,
      name: file.name,
      storage_path: storagePath,
      file_type: ext || null,
      file_size_bytes: file.size,
      shared_by: 'team',
    })

    setUploading(false)
    router.refresh()
  }

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) await uploadFile(file)
    e.target.value = ''
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await uploadFile(file)
  }

  async function resolveUrl(doc: AttachmentDoc): Promise<string | null> {
    if (doc.signedUrl) return doc.signedUrl
    const { data } = await supabase.storage.from('project-documents').createSignedUrl(doc.storage_path, 3600)
    return data?.signedUrl ?? null
  }

  async function handleDownload(doc: AttachmentDoc) {
    const url = await resolveUrl(doc)
    if (url) window.open(url, '_blank')
  }

  async function handleOpen(doc: AttachmentDoc) {
    const url = await resolveUrl(doc)
    if (!url) return
    if (isImageFile(doc.file_type)) {
      setLightbox({ url, name: doc.name })
    } else {
      window.open(url, '_blank')
    }
  }

  async function handleDelete(doc: AttachmentDoc) {
    if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return
    await supabase.storage.from('project-documents').remove([doc.storage_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    router.refresh()
  }

  const hasAny = initialDocuments.length > 0

  return (
    <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Paperclip size={12} /> Attachments{hasAny ? ` (${initialDocuments.length})` : ''}
        </span>
        {canAct && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-600)', fontSize: '12px' }}
          >
            <Upload size={12} /> {uploading ? 'Uploading…' : 'Upload'}
          </button>
        )}
        {canAct && <input ref={fileInputRef} type="file" onChange={handleFileInput} style={{ display: 'none' }} />}
      </div>

      {images.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: files.length > 0 ? '10px' : 0 }}>
          {images.map(doc => (
            <div key={doc.id} style={{ position: 'relative', width: '56px', height: '56px' }}>
              <button
                onClick={() => handleOpen(doc)}
                title={doc.name}
                style={{ width: '56px', height: '56px', borderRadius: '8px', overflow: 'hidden', border: 'none', padding: 0, cursor: 'pointer', background: 'var(--bg-tertiary)' }}
              >
                {doc.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={doc.signedUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '18px' }}>🖼</span>
                )}
              </button>
              {canAct && (doc.shared_by !== 'client' || canDeleteClientDocs) && (
                <button
                  onClick={() => handleDelete(doc)}
                  title="Delete"
                  style={{
                    position: 'absolute', top: '-5px', right: '-5px', width: '18px', height: '18px', borderRadius: '50%',
                    background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', color: 'var(--text-tertiary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
                  }}
                >
                  <Trash2 size={9} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div
        onDragOver={e => { if (canAct) { e.preventDefault(); setDragOver(true) } }}
        onDragLeave={() => setDragOver(false)}
        onDrop={canAct ? handleDrop : undefined}
        style={{
          border: dragOver ? '1.5px dashed var(--brand-600)' : files.length ? 'none' : (canAct && !images.length ? '1.5px dashed var(--border-medium)' : 'none'),
          borderRadius: '8px',
          background: dragOver ? 'var(--brand-50)' : 'transparent',
          padding: files.length ? 0 : (canAct && !images.length ? '16px' : 0),
          textAlign: files.length ? 'left' : 'center',
        }}
      >
        {!hasAny ? (
          canAct && <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Drop a file here, or click Upload</span>
        ) : files.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {files.map(doc => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 9px', background: 'var(--bg-tertiary)', borderRadius: '7px' }}>
                <button
                  onClick={() => handleOpen(doc)}
                  title="Open"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                >
                  <span style={{ fontSize: '14px', flexShrink: 0 }}>{FILE_ICON[doc.file_type?.toLowerCase() ?? ''] ?? '📎'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                      {doc.file_size_bytes ? formatFileSize(doc.file_size_bytes) : ''} · {formatDate(doc.created_at)}
                    </div>
                  </div>
                </button>
                <button onClick={() => handleDownload(doc)} title="Download" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: '3px' }}>
                  <Download size={13} />
                </button>
                {canAct && (doc.shared_by !== 'client' || canDeleteClientDocs) && (
                  <button onClick={() => handleDelete(doc)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: '3px' }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <ImageLightbox src={lightbox?.url ?? null} alt={lightbox?.name ?? ''} onClose={() => setLightbox(null)} />
    </div>
  )
}
