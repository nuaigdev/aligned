import { createServiceRoleClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatDateTime } from '@/lib/utils'
import { Logo } from '@/components/Logo'
import SignForm from './SignForm'

export default async function SignPage({ params }: { params: { approvalToken: string } }) {
  const supabase = createServiceRoleClient()

  const { data: link } = await supabase
    .from('approval_links')
    .select('*, projects(name, clients(name))')
    .eq('token', params.approvalToken)
    .single()

  if (!link) notFound()

  let targetTitle = ''
  let targetDescription = ''
  let targetType = link.target_type

  if (targetType === 'decision') {
    const { data: decision } = await supabase
      .from('decisions')
      .select('title, description, ref_number')
      .eq('id', link.target_id)
      .single()
    if (decision) {
      targetTitle = decision.title
      targetDescription = decision.description || ''
    }
  } else {
    const { data: milestone } = await supabase
      .from('milestones')
      .select('title, description')
      .eq('id', link.target_id)
      .single()
    if (milestone) {
      targetTitle = milestone.title
      targetDescription = milestone.description || ''
    }
  }

  const { data: documents } = await supabase
    .from('documents')
    .select('id, name, file_type, storage_path')
    .eq(targetType === 'decision' ? 'decision_id' : 'milestone_id', link.target_id)

  const projectName = (link.projects as any)?.name || 'Project'
  const clientName = (link.projects as any)?.clients?.name || 'your organisation'
  const isSigned = link.status === 'signed'
  const isSuperseded = link.status === 'superseded'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '520px' }}>

        {/* Card */}
        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border-default)', borderRadius: '16px', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ padding: '20px 24px', borderBottom: '0.5px solid var(--border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Logo size={20} showWordmark={false} />
              <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>{projectName}</span>
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              padding: '3px 10px',
              borderRadius: '10px',
              background: 'var(--brand-50)',
              color: 'var(--brand-800)',
              fontWeight: 500,
              marginBottom: '10px',
            }}>
              {targetType === 'decision' ? '✍ Decision approval' : '✍ Milestone sign-off'}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4, marginBottom: '6px' }}>
              {targetTitle}
            </div>
            {targetDescription && (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {targetDescription}
              </div>
            )}
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
              Sent by NuAIg · {new Date(link.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Already signed */}
            {isSigned && (
              <div style={{
                background: 'var(--success-bg)',
                border: '0.5px solid #97C459',
                borderRadius: '10px',
                padding: '14px 16px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--success-text)', marginBottom: '4px' }}>
                  ✓ Already signed
                </div>
                <div style={{ fontSize: '13px', color: 'var(--success-text)' }}>
                  Signed by <strong>{link.signed_by_name || link.recipient_name}</strong> on {formatDateTime(link.signed_at)}
                </div>
              </div>
            )}

            {/* Superseded */}
            {isSuperseded && (
              <div style={{
                background: 'var(--warning-bg)',
                border: '0.5px solid #EF9F27',
                borderRadius: '10px',
                padding: '14px 16px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--warning-text)', marginBottom: '4px' }}>
                  This item has already been signed
                </div>
                <div style={{ fontSize: '13px', color: 'var(--warning-text)' }}>
                  {link.signed_by_name
                    ? `Signed by ${link.signed_by_name} on ${formatDateTime(link.signed_at)}`
                    : 'Another contact has already provided their sign-off.'}
                </div>
              </div>
            )}

            {/* Documents */}
            {documents && documents.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>Attached documents</div>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', overflow: 'hidden' }}>
                  {documents.map((doc, i) => (
                    <div key={doc.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '9px 12px',
                      borderBottom: i < documents.length - 1 ? '0.5px solid var(--border-default)' : 'none',
                    }}>
                      <span style={{ fontSize: '14px' }}>
                        {doc.file_type === 'pdf' ? '📄' : doc.file_type?.startsWith('image') ? '🖼' : '📎'}
                      </span>
                      <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)' }}>{doc.name}</span>
                      <span style={{ fontSize: '12px', color: '#EA580C', cursor: 'pointer' }}>View</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sign form */}
            {!isSigned && !isSuperseded && (
              <SignForm
                approvalToken={params.approvalToken}
                recipientName={link.recipient_name}
                recipientEmail={link.recipient_email}
                clientName={clientName}
                projectName={projectName}
              />
            )}

          </div>
        </div>

        <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: '14px' }}>
          This is a secure sign-off link for {link.recipient_email} only.
        </p>
      </div>
    </div>
  )
}
