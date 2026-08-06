'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createProjectAssignmentNotification } from '@/lib/notifications/create'

async function currentTeamMemberId(): Promise<string | null> {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

/**
 * Who's actually allowed to add/remove is enforced by RLS
 * (can_manage_project_members — admin, the client's Manager, or an
 * existing project member; migration 038). These pre-checks just
 * give a clearer error than a bare RLS violation.
 */
export async function addProjectMember(projectId: string, teamMemberId: string): Promise<{ ok: true } | { error: string }> {
  const callerId = await currentTeamMemberId()
  if (!callerId) return { error: 'Not signed in.' }

  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('project_members').insert({
    project_id: projectId,
    team_member_id: teamMemberId,
    added_by: callerId,
  })

  if (error) {
    if (error.code === '23505') return { error: 'Already on this project.' }
    return { error: 'Could not add them — you may not have access to manage this project\'s team.' }
  }

  const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).maybeSingle()
  await createProjectAssignmentNotification(supabase, [teamMemberId], callerId, projectId, project?.name ?? 'a project')

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { ok: true }
}

export async function removeProjectMember(projectId: string, teamMemberId: string): Promise<{ ok: true } | { error: string }> {
  const callerId = await currentTeamMemberId()
  if (!callerId) return { error: 'Not signed in.' }

  const supabase = createSupabaseServerClient()
  // .select() on the delete is what makes an RLS-blocked removal visible —
  // when can_remove_project_member (migration 043) says no, Postgres just
  // silently filters the row out of the delete rather than raising an
  // error, so `error` stays null. Without checking the returned rows this
  // reported success (and optimistically hid the row) even though nothing
  // was actually deleted — surfaced as "removed" in the toast, but back
  // after a refresh, and the RLS-blocked person still occupying the unique
  // (project_id, team_member_id) slot when you tried to re-add them.
  const { data, error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('team_member_id', teamMemberId)
    .select('id')

  if (error) {
    return { error: 'Could not remove them — you may not have access to manage this project\'s team.' }
  }

  if (!data || data.length === 0) {
    // Same RLS rule, silent-filter case: removing the client's assigned
    // Manager requires admin — give that specific case a clearer message
    // than the generic fallback.
    const { data: project } = await supabase.from('projects').select('client_id, clients(manager_id)').eq('id', projectId).maybeSingle()
    if ((project?.clients as any)?.manager_id === teamMemberId) {
      return { error: "This client's assigned Manager can't be removed from the project — ask an admin." }
    }
    return { error: 'Could not remove them — you may not have access to manage this project\'s team.' }
  }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { ok: true }
}
