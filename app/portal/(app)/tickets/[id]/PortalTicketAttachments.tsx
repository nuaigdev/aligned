'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Paperclip, Upload } from 'lucide-react'
import { uploadPortalAttachment } from '@/lib/tickets/portal-actions'
import { formatFileSize, formatDate } from '@/lib/utils'
import { ImageLightbox, isImageFile } from '@/components/dashboard/ImageLightbox'

const FILE_ICON: Record<string, string> = {
  pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
  ppt: '📑', pptx: '📑', png: '🖼', jpg: '🖼', jpeg: '🖼', gif: '🖼', zip: '📦', csv: '📊',
}

interface AttachmentWithUrl {
  id: string
  name: string
  file_type: string | null
  file_size_bytes: number | null
  shared_by: 'team' | 'client'
  created_at: string
  signedUrl: string | null
}

export default function PortalTicketAttachments({
  ticketId,
  initialDocuments,
}: {
  ticketId: string
  initialDocuments: AttachmentWithUrl[]
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null)

  const images = initialDocuments.filter(d => isImageFile(d.file_type))
  const files = initialDocuments.filter(d => !isImageFile(d.file_type))

  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.set('ticket_id', ticketId)
    formData.set('file', file)
    const result = await uploadPortalAttachment(formData)
    setUploading(false)

    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success('Attached')
    router.refresh()
  }

  if (initialDocuments.length === 0 && !uploading) {
    return (
      <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Paperclip size={12} /> Attachments
          </span>
          <button onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-600)', fontSize: '12px' }}>
            <Upload size={12} /> Attach a file
          </button>
          <input ref={fileInputRef} type="file" onChange={handleFileInput} style={{ display: 'none' }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '10px', padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Paperclip size={12} /> Attachments ({initialDocuments.length})
        </span>
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-600)', fontSize: '12px' }}>
          <Upload size={12} /> {uploading ? 'Uploading…' : 'Attach a file'}
        </button>
        <input ref={fileInputRef} type="file" onChange={handleFileInput} style={{ display: 'none' }} />
      </div>

      {images.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: files.length > 0 ? '10px' : 0 }}>
          {images.map(doc => (
            <button
              key={doc.id}
              onClick={() => doc.signedUrl && setLightbox({ url: doc.signedUrl, name: doc.name })}
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
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {files.map(doc => (
            <a
              key={doc.id}
              href={doc.signedUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 9px', background: 'var(--bg-tertiary)', borderRadius: '7px', textDecoration: 'none' }}
            >
              <span style={{ fontSize: '14px', flexShrink: 0 }}>{FILE_ICON[doc.file_type?.toLowerCase() ?? ''] ?? '📎'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                  {doc.file_size_bytes ? `${formatFileSize(doc.file_size_bytes)} · ` : ''}{formatDate(doc.created_at)} · {doc.shared_by === 'team' ? 'From NuAIg' : 'You attached this'}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      <ImageLightbox src={lightbox?.url ?? null} alt={lightbox?.name ?? ''} onClose={() => setLightbox(null)} />
    </div>
  )
}
