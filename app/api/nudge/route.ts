import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { sendNudgeEmail } from '@/lib/email'

// This route can be called by a cron job (Vercel Cron or external)
// Set up in vercel.json: { "crons": [{ "path": "/api/nudge", "schedule": "0 9 * * *" }] }

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceRoleClient()
  const now = new Date()
  const nudgeDays = 3 // nudge after 3 days of no action

  // Find pending approvals older than nudgeDays that haven't been nudged recently
  const cutoff = new Date(now.getTime() - nudgeDays * 24 * 60 * 60 * 1000).toISOString()
  const nudgeCutoff = new Date(now.getTime() - nudgeDays * 24 * 60 * 60 * 1000).toISOString()

  const { data: pending } = await supabase
    .from('approval_links')
    .select('*, projects(name)')
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .or(`last_nudge_at.is.null,last_nudge_at.lt.${nudgeCutoff}`)
    .lt('nudge_count', 3) // max 3 nudges

  if (!pending?.length) {
    return NextResponse.json({ nudged: 0 })
  }

  let nudged = 0

  for (const link of pending) {
    // Get target title
    let targetTitle = ''
    if (link.target_type === 'decision') {
      const { data } = await supabase.from('decisions').select('title').eq('id', link.target_id).single()
      targetTitle = data?.title || ''
    } else {
      const { data } = await supabase.from('milestones').select('title').eq('id', link.target_id).single()
      targetTitle = data?.title || ''
    }

    try {
      await sendNudgeEmail({
        recipientName: link.recipient_name,
        recipientEmail: link.recipient_email,
        approvalToken: link.token,
        projectName: (link.projects as any)?.name || 'Project',
        targetTitle,
        nudgeCount: link.nudge_count + 1,
      })

      await supabase
        .from('approval_links')
        .update({
          nudge_count: link.nudge_count + 1,
          last_nudge_at: now.toISOString(),
        })
        .eq('id', link.id)

      nudged++
    } catch {
      console.error(`Failed to nudge ${link.recipient_email}`)
    }
  }

  return NextResponse.json({ nudged })
}
