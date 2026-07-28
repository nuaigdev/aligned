'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireClientSession } from '@/lib/portal/session-guard'

/**
 * The client login is one shared credential per company (see
 * CLAUDE.md's Notifications section) so there's no individual to mark
 * things "read" for — this drives a simple "something happened since
 * you last opened the portal" blip instead of a real per-item
 * notification list. "Activity" is: a team reply/status change that's
 * actually visible to the client — internal notes and the client's
 * own comments don't count.
 */
export async function hasNewPortalActivity(clientId: string, lastSeenAt: string | null): Promise<boolean> {
  const supabase = createServiceRoleClient()
  const since = lastSeenAt ?? '1970-01-01T00:00:00Z'

  const [{ count: commentCount }, { count: ticketCount }, { count: decisionCount }, { count: milestoneCount }] = await Promise.all([
    supabase
      .from('ticket_comments')
      .select('id, tickets!inner(client_id)', { count: 'exact', head: true })
      .eq('tickets.client_id', clientId)
      .is('created_by_client_name', null)
      .eq('visible_to_client', true)
      .gt('created_at', since),
    supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .gt('updated_at', since),
    // A decision sent for approval/reopened for review — decisions have no
    // email step anymore (migration 030), so this blip is the notification.
    supabase
      .from('decisions')
      .select('id, projects!inner(client_id)', { count: 'exact', head: true })
      .eq('projects.client_id', clientId)
      .eq('status', 'pending_approval')
      .gt('updated_at', since),
    supabase
      .from('milestones')
      .select('id, projects!inner(client_id)', { count: 'exact', head: true })
      .eq('projects.client_id', clientId)
      .eq('status', 'awaiting_signoff')
      .gt('updated_at', since),
  ])

  return (commentCount ?? 0) > 0 || (ticketCount ?? 0) > 0 || (decisionCount ?? 0) > 0 || (milestoneCount ?? 0) > 0
}

export async function markPortalSeen(): Promise<{ ok: true }> {
  const session = await requireClientSession()
  const supabase = createServiceRoleClient()
  await supabase.from('clients').update({ last_portal_seen_at: new Date().toISOString() }).eq('id', session.clientId)
  return { ok: true }
}
