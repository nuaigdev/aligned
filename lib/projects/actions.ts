'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireTeamRole } from '@/lib/auth/team-role-guard'

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

  revalidatePath('/dashboard/projects')
  return { id: data.id }
}

/**
 * Deletes the project. Milestones/decisions/documents/approval links for it
 * cascade-delete too (ON DELETE CASCADE). Tickets do NOT — a ticket's
 * project_id is optional and ON DELETE SET NULL, so tickets survive under
 * the client with no project link rather than disappearing.
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
