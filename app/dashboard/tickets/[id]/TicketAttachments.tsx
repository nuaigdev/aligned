'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { formatFileSize, formatDate } from '@/lib/utils'
import { Paperclip, Download, Trash2, Upload } from 'lucide-react'
import type { Document } from '@/types'

const FILE_ICON: Record<string, string> = {
  pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
  ppt: '📑', pptx: '📑', png: '🖼', jpg: '🖼', jpeg: '🖼', gif: '🖼', zip: '📦', csv: '📊',
}

export default function TicketAttachments({
  ticketId,
  projectId,
  initialDocuments,
}: {
  ticketId: string
  projectId: string | null
  initialDocuments: Document[]
}) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

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

  async function handleDownload(doc: Document) {
    const { data } = await supabase.storage.from('project-documents').createSignedUrl(doc.storage_path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return
    await supabase.storage.from('project-documents').remove([doc.storage_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    router.refresh()
  }

  return (
    <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Paperclip size={12} /> Attachments{initialDocuments.length > 0 ? ` (${initialDocuments.length})` : ''}
        </span>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-600)', fontSize: '12px' }}
        >
          <Upload size={12} /> {uploading ? 'Uploading…' : 'Upload'}
        </button>
        <input ref={fileInputRef} type="file" onChange={handleFileInput} style={{ display: 'none' }} />
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: dragOver ? '1.5px dashed var(--brand-600)' : initialDocuments.length ? 'none' : '1.5px dashed var(--border-medium)',
          borderRadius: '8px',
          background: dragOver ? 'var(--brand-50)' : 'transparent',
          padding: initialDocuments.length ? 0 : '16px',
          textAlign: initialDocuments.length ? 'left' : 'center',
        }}
      >
        {initialDocuments.length === 0 ? (
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Drop a file here, or click Upload</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {initialDocuments.map(doc => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 9px', background: 'var(--bg-tertiary)', borderRadius: '7px' }}>
                <span style={{ fontSize: '14px', flexShrink: 0 }}>{FILE_ICON[doc.file_type?.toLowerCase() ?? ''] ?? '📎'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                    {doc.file_size_bytes ? formatFileSize(doc.file_size_bytes) : ''} · {formatDate(doc.created_at)}
                  </div>
                </div>
                <button onClick={() => handleDownload(doc)} title="Download" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: '3px' }}>
                  <Download size={13} />
                </button>
                <button onClick={() => handleDelete(doc)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: '3px' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
