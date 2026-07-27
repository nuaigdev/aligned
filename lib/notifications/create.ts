import type { SupabaseClient } from '@supabase/supabase-js'
import type { NotificationType } from '@/types'

/**
 * Direct port of Chronos's actor-named notification convention:
 * "‹Actor› commented/assigned/moved …", recipients are always the
 * ticket's assignees + creator (or the client's Manager for a
 * client-raised ticket), minus the actor. Runs on whichever
 * supabase client the caller already has open — the authenticated
 * server client for team actions, the service-role client for
 * portal actions (system-generated, no team actor).
 */
export async function createTicketNotifications(
  supabase: SupabaseClient,
  recipientIds: string[],
  actorId: string | null,
  type: NotificationType,
  title: string,
  body: string,
  ticketId: string
) {
  const targets = Array.from(new Set(recipientIds)).filter(id => id && id !== actorId)
  if (targets.length === 0) return

  await supabase.from('notifications').insert(
    targets.map(team_member_id => ({ team_member_id, type, title, body, ticket_id: ticketId }))
  )
}

export async function getActorName(supabase: SupabaseClient, teamMemberId: string | null): Promise<string> {
  if (!teamMemberId) return 'Someone'
  const { data } = await supabase.from('team_members').select('name').eq('id', teamMemberId).maybeSingle()
  return data?.name ?? 'Someone'
}
