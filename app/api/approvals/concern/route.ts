import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { sendConcernNotification } from '@/lib/email'

export async function POST(req: NextRequest) {
  const { token, concern } = await req.json()
  if (!token || !concern) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const supabase = createServiceRoleClient()

  const { data: link } = await supabase
    .from('approval_links')
    .select('*, projects(name, team_members(email))')
    .eq('token', token)
    .single()

  if (!link) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

  const now = new Date().toISOString()

  await supabase
    .from('approval_links')
    .update({ concern_text: concern, concern_raised_at: now })
    .eq('id', link.id)

  // Fetch target title for the notification
  let targetTitle = ''
  if (link.target_type === 'decision') {
    const { data } = await supabase.from('decisions').select('title').eq('id', link.target_id).single()
    targetTitle = data?.title || ''
  } else {
    const { data } = await supabase.from('milestones').select('title').eq('id', link.target_id).single()
    targetTitle = data?.title || ''
  }

  // Notify team via email
  const teamEmail = process.env.RESEND_FROM_EMAIL || 'team@nuaig.com'
  try {
    await sendConcernNotification({
      projectName: (link.projects as any)?.name || 'Project',
      raisedByName: link.recipient_name,
      raisedByEmail: link.recipient_email,
      targetTitle,
      concernText: concern,
      teamEmail,
    })
  } catch {
    // Log but don't fail — concern is already saved
    console.error('Failed to send concern notification email')
  }

  return NextResponse.json({ success: true })
}
