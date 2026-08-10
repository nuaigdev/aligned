'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { requireTeamRole } from '@/lib/auth/team-role-guard'
import { hashPassword, generateTempPassword } from '@/lib/auth/client-session'

export async function setClientManager(
  clientId: string,
  managerId: string | null
): Promise<{ ok: true } | { error: string }> {
  const check = await requireTeamRole(['admin', 'manager'])
  if ('error' in check) return check

  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('clients').update({ manager_id: managerId }).eq('id', clientId)
  if (error) return { error: error.message }

  revalidatePath(`/dashboard/clients/${clientId}`)
  return { ok: true }
}

/**
 * Creates a new named login for this client. Returns the plaintext
 * password exactly once — only the hash is ever persisted. The admin
 * or manager relays this to the named contact out of band (phone/
 * email); it cannot be retrieved again after this call returns. A
 * client can have any number of these — each is independent (own id,
 * own password) and all see the exact same client-scoped portal data.
 */
export async function createClientLogin(
  clientId: string,
  loginId: string,
  contactName: string
): Promise<{ password: string } | { error: string }> {
  const check = await requireTeamRole(['admin', 'manager'])
  if ('error' in check) return check
  if (!loginId.trim()) return { error: 'Choose a login ID.' }
  if (!contactName.trim()) return { error: "Give this login the contact's name." }

  const supabase = createSupabaseServerClient()
  const password = generateTempPassword()
  const passwordHash = await hashPassword(password)

  const { error } = await supabase
    .from('client_logins')
    .insert({
      client_id: clientId,
      contact_name: contactName.trim(),
      login_id: loginId.trim().toLowerCase(),
      password_hash: passwordHash,
      must_change_password: true,
      created_by: check.id,
    })

  if (error) {
    if (error.code === '23505') return { error: 'That login ID is already taken.' }
    return { error: error.message }
  }

  revalidatePath(`/dashboard/clients/${clientId}`)
  return { password }
}

/** Resets one login's password — the other logins on this client are untouched. */
export async function resetClientLoginPassword(
  clientLoginId: string
): Promise<{ password: string } | { error: string }> {
  const check = await requireTeamRole(['admin', 'manager'])
  if ('error' in check) return check

  const supabase = createSupabaseServerClient()
  const password = generateTempPassword()
  const passwordHash = await hashPassword(password)

  const { data, error } = await supabase
    .from('client_logins')
    .update({ password_hash: passwordHash, must_change_password: true })
    .eq('id', clientLoginId)
    .select('client_id')
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/clients/${data.client_id}`)
  return { password }
}

/** Deactivates one login — it can no longer sign in, but its history (past comments/tickets) is untouched. */
export async function revokeClientLogin(clientLoginId: string): Promise<{ ok: true } | { error: string }> {
  const check = await requireTeamRole(['admin', 'manager'])
  if ('error' in check) return check

  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('client_logins')
    .update({ is_active: false })
    .eq('id', clientLoginId)
    .select('client_id')
    .single()

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/clients/${data.client_id}`)
  return { ok: true }
}
