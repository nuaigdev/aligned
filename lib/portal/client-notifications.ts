'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireClientSession } from '@/lib/portal/session-guard'
import type { ClientNotificationRow } from '@/types'

/**
 * Real notification list for the client portal — structurally
 * identical to the team's notifications (components/dashboard/
 * NotificationBell.tsx / hooks/useNotifications.tsx), just scoped by
 * client_id instead of team_member_id since the login is shared per
 * company (see migration 032). No Realtime here — the client session
 * isn't a Supabase Auth principal, so PortalNotificationBell.tsx polls
 * this instead of subscribing.
 */
export async function getClientNotifications(): Promise<ClientNotificationRow[]> {
  const session = await requireClientSession()
  const supabase = createServiceRoleClient()
  const { data } = await supabase
    .from('client_notifications')
    .select('*')
    .eq('client_id', session.clientId)
    .order('created_at', { ascending: false })
    .limit(50)
  return (data ?? []) as ClientNotificationRow[]
}

export async function markClientNotificationRead(id: string): Promise<{ ok: true }> {
  const session = await requireClientSession()
  const supabase = createServiceRoleClient()
  await supabase.from('client_notifications').update({ is_read: true }).eq('id', id).eq('client_id', session.clientId)
  return { ok: true }
}

export async function markAllClientNotificationsRead(): Promise<{ ok: true }> {
  const session = await requireClientSession()
  const supabase = createServiceRoleClient()
  await supabase.from('client_notifications').update({ is_read: true }).eq('client_id', session.clientId).eq('is_read', false)
  return { ok: true }
}
