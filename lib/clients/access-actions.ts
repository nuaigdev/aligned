'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { hashPassword, generateTempPassword } from '@/lib/auth/client-session'

export async function setClientManager(
  clientId: string,
  managerId: string | null
): Promise<{ ok: true } | { error: string }> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('clients').update({ manager_id: managerId }).eq('id', clientId)
  if (error) return { error: error.message }

  revalidatePath(`/dashboard/clients/${clientId}`)
  return { ok: true }
}

/**
 * Issues (or resets) the client's shared login. Returns the plaintext
 * password exactly once — only the hash is ever persisted. The admin
 * relays this to the client out of band (phone/email); it cannot be
 * retrieved again after this call returns.
 */
export async function issueClientCredentials(
  clientId: string,
  loginId: string
): Promise<{ password: string } | { error: string }> {
  if (!loginId.trim()) return { error: 'Choose a login ID.' }

  const supabase = createSupabaseServerClient()
  const password = generateTempPassword()
  const passwordHash = await hashPassword(password)

  const { error } = await supabase
    .from('clients')
    .update({
      login_id: loginId.trim().toLowerCase(),
      password_hash: passwordHash,
      must_change_password: true,
    })
    .eq('id', clientId)

  if (error) {
    if (error.code === '23505') return { error: 'That login ID is already taken.' }
    return { error: error.message }
  }

  revalidatePath(`/dashboard/clients/${clientId}`)
  return { password }
}

export async function revokeClientCredentials(clientId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('clients')
    .update({ login_id: null, password_hash: null, must_change_password: true })
    .eq('id', clientId)

  if (error) return { error: error.message }
  revalidatePath(`/dashboard/clients/${clientId}`)
  return { ok: true }
}
