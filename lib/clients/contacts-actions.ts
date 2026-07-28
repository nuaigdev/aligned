'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireTeamRole } from '@/lib/auth/team-role-guard'

/**
 * Managing a client's default contacts is part of "editing the
 * client" — admin-only, same as the manager/login controls on the
 * same page (see lib/clients/access-actions.ts).
 */
export async function addClientContact(input: {
  clientId: string
  name: string
  email: string
}): Promise<{ ok: true } | { error: string }> {
  const check = await requireTeamRole(['admin'])
  if ('error' in check) return check
  if (!input.name.trim() || !input.email.trim()) return { error: 'Name and email are required.' }

  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('client_contacts').insert({
    client_id: input.clientId,
    project_id: null,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    is_active: true,
  })

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/clients/${input.clientId}`)
  return { ok: true }
}

export async function removeClientContact(clientId: string, contactId: string): Promise<{ ok: true } | { error: string }> {
  const check = await requireTeamRole(['admin'])
  if ('error' in check) return check

  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('client_contacts')
    .update({ is_active: false, removed_at: new Date().toISOString() })
    .eq('id', contactId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/clients/${clientId}`)
  return { ok: true }
}
