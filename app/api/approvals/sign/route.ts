import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export async function POST(req: NextRequest) {
  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const supabase = createServiceRoleClient()
  const headersList = headers()
  const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || null
  const userAgent = headersList.get('user-agent') || null

  // Fetch the approval link
  const { data: link } = await supabase
    .from('approval_links')
    .select('*')
    .eq('token', token)
    .single()

  if (!link) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  if (link.status === 'signed') return NextResponse.json({ error: 'Already signed' }, { status: 409 })
  if (link.status === 'superseded') return NextResponse.json({ error: 'Superseded' }, { status: 409 })
  if (link.status === 'expired') return NextResponse.json({ error: 'Expired' }, { status: 410 })

  const now = new Date().toISOString()

  // Mark this link as signed
  await supabase
    .from('approval_links')
    .update({ status: 'signed', signed_at: now })
    .eq('id', link.id)

  // Supersede all other pending links for the same target
  await supabase
    .from('approval_links')
    .update({ status: 'superseded' })
    .eq('target_type', link.target_type)
    .eq('target_id', link.target_id)
    .eq('status', 'pending')
    .neq('id', link.id)

  // Update the decision or milestone as approved/signed
  if (link.target_type === 'decision') {
    await supabase
      .from('decisions')
      .update({
        status: 'approved',
        signed_at: now,
        signed_by_name: link.recipient_name,
        signed_by_email: link.recipient_email,
      })
      .eq('id', link.target_id)
  } else {
    await supabase
      .from('milestones')
      .update({ status: 'completed', completed_at: now })
      .eq('id', link.target_id)

    // Write immutable signoff audit record
    await supabase
      .from('milestone_signoffs')
      .insert({
        milestone_id: link.target_id,
        approval_link_id: link.id,
        signed_by_name: link.recipient_name,
        signed_by_email: link.recipient_email,
        signed_at: now,
        ip_address: ip,
        user_agent: userAgent,
      })
  }

  return NextResponse.json({ success: true })
}
