'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'

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

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { ok: true }
}

export async function removeProjectMember(projectId: string, teamMemberId: string): Promise<{ ok: true } | { error: string }> {
  const callerId = await currentTeamMemberId()
  if (!callerId) return { error: 'Not signed in.' }

  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('team_member_id', teamMemberId)

  if (error) return { error: 'Could not remove them — you may not have access to manage this project\'s team.' }

  revalidatePath(`/dashboard/projects/${projectId}`)
  return { ok: true }
}
