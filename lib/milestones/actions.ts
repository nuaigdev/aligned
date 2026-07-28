'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { requireTeamRole } from '@/lib/auth/team-role-guard'
import { createClientNotification } from '@/lib/notifications/create'

/**
 * Sends a client-gate milestone to the client for sign-off — same
 * portal-native pattern decisions use (migration 030): no recipient
 * picker, no email, just a status change plus a portal notification.
 */
export async function sendMilestoneForSignoff(milestoneId: string): Promise<{ ok: true } | { error: string }> {
  const check = await requireTeamRole(['admin', 'manager'])
  if ('error' in check) return check

  const supabase = createSupabaseServerClient()
  const { data: milestone } = await supabase
    .from('milestones')
    .select('id, project_id, title, type, projects(client_id)')
    .eq('id', milestoneId)
    .maybeSingle()

  if (!milestone) return { error: 'Milestone not found.' }
  if (milestone.type !== 'client_gate') return { error: 'Only client-gate milestones need sign-off.' }

  const { error } = await supabase.from('milestones').update({ status: 'awaiting_signoff' }).eq('id', milestoneId)
  if (error) return { error: error.message }

  const clientId = (milestone.projects as any)?.client_id
  if (clientId) {
    const service = createServiceRoleClient()
    await createClientNotification(
      service, clientId, 'milestone_signoff_pending',
      'A milestone needs your sign-off', milestone.title,
      `/portal/projects/${milestone.project_id}/milestones`
    )
  }

  revalidatePath(`/dashboard/projects/${milestone.project_id}/milestones`)
  revalidatePath(`/portal/projects/${milestone.project_id}/milestones`)
  revalidatePath(`/portal/projects/${milestone.project_id}`)
  return { ok: true }
}
