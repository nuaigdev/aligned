'use client'

import { useState } from 'react'
import { formatDate, formatFileSize } from '@/lib/utils'

const FILE_ICON: Record<string, string> = {
  pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
  ppt: '📑', pptx: '📑', png: '🖼', jpg: '🖼', jpeg: '🖼',
  gif: '🖼', webp: '🖼', zip: '📦', csv: '📊',
}

function fileIcon(fileType: string | null) {
  if (!fileType) return '📎'
  return FILE_ICON[fileType.toLowerCase()] ?? '📎'
}

interface DocWithUrl {
  id: string
  name: string
  file_type: string | null
  file_size_bytes: number | null
  phase: string | null
  shared_by: 'team' | 'client'
  created_at: string
  signedUrl: string | null
}

export default function DocumentsPortalPanel({
  docs,
  clientName,
}: {
  docs: DocWithUrl[]
  clientName: string
}) {
  const [filter, setFilter] = useState<'all' | 'team' | 'client'>('all')

  const filtered = docs.filter(d => {
    if (filter === 'all') return true
    return d.shared_by === filter
  })

  // Group by phase
  const phaseOrder: string[] = []
  const phaseMap: Record<string, DocWithUrl[]> = {}

  for (const d of filtered) {
    const phase = d.phase || '__general__'
    if (!phaseMap[phase]) {
      phaseMap[phase] = []
      phaseOrder.push(phase)
    }
    phaseMap[phase]!.push(d)
  }

  const filterBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: active ? 500 : 400,
    cursor: 'pointer',
    border: active ? '0.5px solid #EA580C' : '0.5px solid rgba(0,0,0,0.12)',
    background: active ? '#FFF7ED' : '#fff',
    color: active ? '#EA580C' : '#5F5E5A',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Filter buttons */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <button style={filterBtnStyle(filter === 'all')} onClick={() => setFilter('all')}>
          All
        </button>
        <button style={filterBtnStyle(filter === 'team')} onClick={() => setFilter('team')}>
          By NuAIg
        </button>
        <button style={filterBtnStyle(filter === 'client')} onClick={() => setFilter('client')}>
          By {clientName}
        </button>
      </div>

      {phaseOrder.length === 0 ? (
        <div style={{
          padding: '48px 32px', textAlign: 'center', background: '#fff',
          border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '10px',
          fontSize: '14px', color: '#888780',
        }}>
          No documents match this filter
        </div>
      ) : (
        phaseOrder.map(phase => {
          const phaseDocs = phaseMap[phase] ?? []
          const showHeader = phase !== '__general__'
          return (
            <div key={phase}>
              {showHeader && (
                <div style={{
                  fontSize: '11px', fontWeight: 500, color: '#888780',
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                  marginBottom: '8px',
                }}>
                  {phase}
                </div>
              )}
              {!showHeader && phaseOrder.length > 1 && (
                <div style={{
                  fontSize: '11px', fontWeight: 500, color: '#888780',
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                  marginBottom: '8px',
                }}>
                  General
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {phaseDocs.map(doc => (
                  <div
                    key={doc.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '11px 14px', background: '#fff',
                      border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: '10px',
                    }}
                  >
                    <span style={{ fontSize: '18px', flexShrink: 0 }}>{fileIcon(doc.file_type)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '13px', fontWeight: 500, color: '#1a1918',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {doc.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#888780', marginTop: '2px' }}>
                        {doc.file_type?.toUpperCase()}
                        {doc.file_size_bytes ? ` · ${formatFileSize(doc.file_size_bytes)}` : ''}
                        {` · ${formatDate(doc.created_at)}`}
                        {` · By ${doc.shared_by === 'team' ? 'NuAIg' : clientName}`}
                      </div>
                    </div>
                    {doc.signedUrl && (
                      <a
                        href={doc.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '12px', padding: '4px 10px', borderRadius: '6px',
                          border: '0.5px solid rgba(0,0,0,0.12)', background: '#fff',
                          color: '#EA580C', cursor: 'pointer', fontWeight: 500,
                          textDecoration: 'none', flexShrink: 0,
                        }}
                      >
                        Download
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
