'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireTeamRole } from '@/lib/auth/team-role-guard'
import { createProjectAssignmentNotification } from '@/lib/notifications/create'

/**
 * Only admins and managers add projects — see the matching note on
 * createClient in lib/clients/actions.ts.
 */
export async function createProject(input: {
  name: string
  clientId: string
  description?: string
  startedAt?: string
  plannedEndAt?: string
}): Promise<{ id: string } | { error: string }> {
  const check = await requireTeamRole(['admin', 'manager'])
  if ('error' in check) return check
  if (!input.name.trim()) return { error: 'Give the project a name.' }
  if (!input.clientId) return { error: 'Choose a client.' }

  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('projects')
    .insert({
      name: input.name.trim(),
      client_id: input.clientId,
      description: input.description?.trim() || null,
      started_at: input.startedAt || null,
      planned_end_at: input.plannedEndAt || null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  // The creator is auto-added as the project's first member — otherwise
  // nobody could add anyone else (can_manage_project_members requires
  // already being a member, or admin/the client's manager). The client's
  // assigned Manager is added alongside them — they already have standing
  // override access to every ticket on this client (is_client_manager_or_admin),
  // so being left off the roster was just a gap, not a boundary; a Set
  // dedupes the common case where the creator *is* that Manager.
  const { data: client } = await supabase.from('clients').select('manager_id').eq('id', input.clientId).maybeSingle()
  const memberIds = new Set([check.id])
  if (client?.manager_id) memberIds.add(client.manager_id)

  await supabase.from('project_members').insert(
    Array.from(memberIds).map(team_member_id => ({
      project_id: data.id,
      team_member_id,
      added_by: check.id,
    }))
  )

  if (client?.manager_id && client.manager_id !== check.id) {
    await createProjectAssignmentNotification(supabase, [client.manager_id], check.id, data.id, input.name.trim())
  }

  revalidatePath('/dashboard/projects')
  return { id: data.id }
}

/**
 * Deletes the project. project_members and ticket attachments filed
 * directly against it cascade-delete too (ON DELETE CASCADE). Tickets do
 * NOT — a ticket's project_id is optional and ON DELETE SET NULL, so
 * tickets survive under the client with no project link rather than
 * disappearing.
 */
export async function deleteProject(projectId: string): Promise<{ ok: true } | { error: string }> {
  const check = await requireTeamRole(['admin', 'manager'])
  if ('error' in check) return check

  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('projects').delete().eq('id', projectId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/projects')
  return { ok: true }
}
