'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Deletes the client and, via ON DELETE CASCADE, every project, ticket,
 * contact, milestone, decision, document, and approval link that belongs
 * to it. There is no undo — the confirmation burden lives in the UI
 * (DeleteConfirmButton requires typing the client's name).
 */
export async function deleteClient(clientId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('clients').delete().eq('id', clientId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/clients')
  return { ok: true }
}
