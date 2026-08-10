'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireTeamRole } from '@/lib/auth/team-role-guard'
import { toSlug } from '@/lib/utils'

/**
 * Admins and managers add clients — the nav/button being hidden from
 * members is a UI nicety, not the boundary (RLS migration 046
 * restricts the INSERT itself too, in case anything ever calls the
 * table directly). Mirrors project creation (lib/projects/actions.ts).
 */
export async function createClient(name: string): Promise<{ id: string } | { error: string }> {
  const check = await requireTeamRole(['admin', 'manager'])
  if ('error' in check) return check
  if (!name.trim()) return { error: 'Give the client a name.' }

  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('clients')
    .insert({ name: name.trim(), slug: toSlug(name) })
    .select('id')
    .single()

  if (error) {
    return { error: error.message.includes('unique') ? 'A client with this name already exists.' : error.message }
  }

  revalidatePath('/dashboard/clients')
  return { id: data.id }
}

/**
 * Deletes the client and, via ON DELETE CASCADE, every project, ticket,
 * contact, and document that belongs to it. There is no undo — the
 * confirmation burden lives in the UI (DeleteConfirmButton requires typing
 * the client's name).
 */
export async function deleteClient(clientId: string): Promise<{ ok: true } | { error: string }> {
  const check = await requireTeamRole(['admin'])
  if ('error' in check) return check

  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('clients').delete().eq('id', clientId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/clients')
  return { ok: true }
}
