'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireClientSession } from '@/lib/portal/session-guard'
import { createTeamNotifications } from '@/lib/notifications/create'

/**
 * Milestone sign-off, done directly in the portal — same reasoning as
 * decisions (migration 030): no email/token round trip. Only
 * client-gate milestones that are currently awaiting_signoff are
 * eligible; signing is terminal (matches the original email-sign
 * behavior — there was never an "unsign").
 */
export async function signOffPortalMilestone(input: {
  milestoneId: string
  contactName: string
}): Promise<{ ok: true } | { error: string }> {
  const session = await requireClientSession()
  if (!input.contactName.trim()) return { error: 'Let us know who this is from.' }

  const supabase = createServiceRoleClient()
  const { data: milestone } = await supabase
    .from('milestones')
    .select('id, project_id, title, type, status, projects(client_id, clients(manager_id))')
    .eq('id', input.milestoneId)
    .maybeSingle()

  if (!milestone || (milestone.projects as any)?.client_id !== session.clientId) {
    return { error: 'That milestone is not part of your account.' }
  }
  if (milestone.type !== 'client_gate') return { error: 'This milestone does not require your sign-off.' }
  if (milestone.status !== 'awaiting_signoff') return { error: 'This milestone is not currently awaiting sign-off.' }

  const now = new Date().toISOString()
  const { error } = await supabase.from('milestones').update({ status: 'completed', completed_at: now }).eq('id', input.milestoneId)
  if (error) return { error: error.message }

  await supabase.from('milestone_signoffs').insert({
    milestone_id: input.milestoneId,
    signed_by_name: input.contactName.trim(),
    signed_by_email: '',
    signed_at: now,
  })

  const managerId = (milestone.projects as any)?.clients?.manager_id
  if (managerId) {
    await createTeamNotifications(
      supabase, [managerId], null, 'milestone_decided',
      'Milestone signed off',
      `${input.contactName.trim()} signed off "${milestone.title}"`,
      `/dashboard/projects/${milestone.project_id}/milestones`
    )
  }

  revalidatePath(`/portal/projects/${milestone.project_id}/milestones`)
  revalidatePath(`/portal/projects/${milestone.project_id}`)
  revalidatePath(`/dashboard/projects/${milestone.project_id}/milestones`)
  return { ok: true }
}

/**
 * Raises a concern on a milestone without blocking it outright —
 * reuses the existing delay_owner/delay_reason fields rather than
 * adding new columns, matching how the old email-based concern flow
 * recorded it (just against the approval_link before; there's no
 * approval_link in the portal-native flow so it goes straight on the
 * milestone).
 */
export async function raisePortalMilestoneConcern(input: {
  milestoneId: string
  contactName: string
  comment: string
}): Promise<{ ok: true } | { error: string }> {
  const session = await requireClientSession()
  if (!input.comment.trim()) return { error: 'Describe your concern.' }

  const supabase = createServiceRoleClient()
  const { data: milestone } = await supabase
    .from('milestones')
    .select('id, project_id, title, status, projects(client_id, clients(manager_id))')
    .eq('id', input.milestoneId)
    .maybeSingle()

  if (!milestone || (milestone.projects as any)?.client_id !== session.clientId) {
    return { error: 'That milestone is not part of your account.' }
  }

  const { error } = await supabase.from('milestones').update({
    delay_owner: 'client',
    delay_reason: `${input.contactName.trim()}: ${input.comment.trim()}`,
  }).eq('id', input.milestoneId)
  if (error) return { error: error.message }

  const managerId = (milestone.projects as any)?.clients?.manager_id
  if (managerId) {
    await createTeamNotifications(
      supabase, [managerId], null, 'milestone_decided',
      'Concern raised on a milestone',
      `${input.contactName.trim()} raised a concern on "${milestone.title}"`,
      `/dashboard/projects/${milestone.project_id}/milestones`
    )
  }

  revalidatePath(`/portal/projects/${milestone.project_id}/milestones`)
  revalidatePath(`/dashboard/projects/${milestone.project_id}/milestones`)
  return { ok: true }
}
