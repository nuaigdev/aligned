import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { sendApprovalEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  // Requires team auth
  const authClient = createSupabaseServerClient()
  const { data: { session } } = await authClient.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { project_id, target_type, target_id, recipients } = await req.json()
  if (!project_id || !target_type || !target_id || !recipients?.length) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  // Fetch project + target title
  const { data: project } = await supabase
    .from('projects')
    .select('name, clients(name)')
    .eq('id', project_id)
    .single()

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  let targetTitle = ''
  if (target_type === 'decision') {
    const { data } = await supabase.from('decisions').select('title').eq('id', target_id).single()
    targetTitle = data?.title || ''
    // Update decision status to pending_approval
    await supabase.from('decisions').update({ status: 'pending_approval' }).eq('id', target_id)
  } else {
    const { data } = await supabase.from('milestones').select('title').eq('id', target_id).single()
    targetTitle = data?.title || ''
    await supabase.from('milestones').update({ status: 'awaiting_signoff' }).eq('id', target_id)
  }

  const clientName = (project.clients as any)?.name || 'Client'
  const errors: string[] = []

  for (const recipient of recipients) {
    // Create approval link row
    const { data: link } = await supabase
      .from('approval_links')
      .insert({
        project_id,
        target_type,
        target_id,
        recipient_name: recipient.name,
        recipient_email: recipient.email,
        status: 'pending',
      })
      .select('token')
      .single()

    if (!link) {
      errors.push(`Failed to create link for ${recipient.email}`)
      continue
    }

    // Send email
    try {
      await sendApprovalEmail({
        recipientName: recipient.name,
        recipientEmail: recipient.email,
        approvalToken: link.token,
        projectName: project.name,
        clientName,
        targetType: target_type,
        targetTitle,
      })
    } catch {
      errors.push(`Failed to send email to ${recipient.email}`)
    }
  }

  return NextResponse.json({
    success: true,
    sent: recipients.length - errors.length,
    errors,
  })
}
