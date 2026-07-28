'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { formatDate, formatFileSize } from '@/lib/utils'
import type { Document } from '@/types'

interface MilestoneOption { id: string; title: string }

const FILE_ICON: Record<string, string> = {
  pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
  ppt: '📑', pptx: '📑', png: '🖼', jpg: '🖼', jpeg: '🖼',
  gif: '🖼', zip: '📦', csv: '📊',
}

function fileIcon(fileType: string | null) {
  if (!fileType) return '📎'
  return FILE_ICON[fileType.toLowerCase()] ?? '📎'
}

export default function DocumentsPanel({
  projectId,
  initialDocuments,
  milestones,
  canManage,
}: {
  projectId: string
  initialDocuments: Document[]
  milestones: MilestoneOption[]
  canManage: boolean
}) {
  const router = useRouter()
  const supabase = createBrowserClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploadMilestoneId, setUploadMilestoneId] = useState('')

  const milestoneTitleById = new Map(milestones.map(m => [m.id, m.title]))

  async function uploadFile(file: File) {
    setUploading(true)
    setUploadError(null)

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${projectId}/${Date.now()}_${safeName}`

    const { error: storageErr } = await supabase.storage
      .from('project-documents')
      .upload(storagePath, file, { cacheControl: '3600', upsert: false })

    if (storageErr) {
      setUploadError(storageErr.message.includes('Bucket') || storageErr.message.includes('not found')
        ? 'Storage bucket not set up yet. Run the storage setup SQL in Supabase first.'
        : storageErr.message)
      setUploading(false)
      return
    }

    await supabase.from('documents').insert({
      project_id: projectId,
      milestone_id: uploadMilestoneId || null,
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
    setDownloadingId(doc.id)
    const { data } = await supabase.storage
      .from('project-documents')
      .createSignedUrl(doc.storage_path, 3600)

    if (data?.signedUrl) {
      const a = document.createElement('a')
      a.href = data.signedUrl
      a.download = doc.name
      a.click()
    }
    setDownloadingId(null)
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return
    await supabase.storage.from('project-documents').remove([doc.storage_path])
    await supabase.from('documents').delete().eq('id', doc.id)
    router.refresh()
  }

  return (
    <div>
      {/* Drop zone / upload area */}
      {canManage && (
        <>
          {milestones.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Attach uploads to a stage (optional)</label>
              <select
                value={uploadMilestoneId}
                onChange={e => setUploadMilestoneId(e.target.value)}
                style={{
                  padding: '7px 10px', border: '0.5px solid var(--border-medium)', borderRadius: '7px',
                  fontSize: '13px', color: 'var(--text-primary)', outline: 'none', background: 'var(--bg-primary)', cursor: 'pointer',
                }}
              >
                <option value="">Not tied to a stage</option>
                {milestones.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
          )}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            border: `1.5px dashed ${dragOver ? '#EA580C' : 'var(--border-medium)'}`,
            borderRadius: '10px',
            padding: '28px',
            textAlign: 'center',
            background: dragOver ? 'var(--brand-50)' : 'var(--bg-primary)',
            marginBottom: '16px',
            transition: 'all .15s',
            cursor: uploading ? 'wait' : 'pointer',
          }}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileInput} />
          {uploading ? (
            <div style={{ fontSize: '13px', color: '#EA580C' }}>Uploading…</div>
          ) : (
            <>
              <div style={{ fontSize: '22px', marginBottom: '8px' }}>📁</div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
                Drop a file here or click to upload
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>PDF, Word, Excel, images and more</div>
            </>
          )}
        </div>
        </>
      )}

      {uploadError && (
        <div style={{ background: 'var(--danger-bg)', border: '0.5px solid #F09595', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: 'var(--danger-text)', marginBottom: '14px' }}>
          {uploadError}
        </div>
      )}

      {/* Document list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {initialDocuments.map(doc => (
          <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px' }}>
            <span style={{ fontSize: '18px', flexShrink: 0 }}>{fileIcon(doc.file_type)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
                {doc.milestone_id && milestoneTitleById.get(doc.milestone_id) && (
                  <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 500, flexShrink: 0 }}>
                    {milestoneTitleById.get(doc.milestone_id)}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                {doc.file_type?.toUpperCase()}
                {doc.file_size_bytes ? ` · ${formatFileSize(doc.file_size_bytes)}` : ''}
                {` · ${formatDate(doc.created_at)}`}
                {doc.uploaded_by ? ` · ${doc.uploaded_by}` : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <button
                onClick={() => handleDownload(doc)}
                disabled={downloadingId === doc.id}
                style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '0.5px solid var(--border-default)', background: 'var(--bg-primary)', color: '#EA580C', cursor: downloadingId === doc.id ? 'wait' : 'pointer', fontWeight: 500 }}
              >
                {downloadingId === doc.id ? '…' : 'Download'}
              </button>
              {canManage && (
                <button
                  onClick={() => handleDelete(doc)}
                  style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '0.5px solid var(--border-default)', background: 'var(--bg-primary)', color: 'var(--danger-text)', cursor: 'pointer' }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}

        {initialDocuments.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>No documents uploaded yet</div>
          </div>
        )}
      </div>
    </div>
  )
}
