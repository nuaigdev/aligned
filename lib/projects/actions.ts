'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Deletes the project. Milestones/decisions/documents/approval links for it
 * cascade-delete too (ON DELETE CASCADE). Tickets do NOT — a ticket's
 * project_id is optional and ON DELETE SET NULL, so tickets survive under
 * the client with no project link rather than disappearing.
 */
export async function deleteProject(projectId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('projects').delete().eq('id', projectId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/projects')
  return { ok: true }
}
