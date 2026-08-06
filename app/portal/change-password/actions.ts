'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireClientSession } from '@/lib/portal/session-guard'
import { hashPassword, verifyPassword } from '@/lib/auth/client-session'
import { clearClientSessionCookie } from '@/lib/auth/client-session-cookies'

export async function changeClientPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true } | { error: string }> {
  const session = await requireClientSession()

  if (newPassword.length < 8) {
    return { error: 'New password must be at least 8 characters.' }
  }
  if (newPassword === currentPassword) {
    return { error: 'Choose a password different from your current one.' }
  }

  const supabase = createServiceRoleClient()
  const { data: client } = await supabase
    .from('clients')
    .select('password_hash')
    .eq('id', session.clientId)
    .maybeSingle()

  if (!client?.password_hash) {
    return { error: 'No password is set on this account yet — ask your NuAIg contact to issue one.' }
  }

  const valid = await verifyPassword(currentPassword, client.password_hash)
  if (!valid) {
    return { error: 'Current password is incorrect.' }
  }

  const newHash = await hashPassword(newPassword)
  const { error } = await supabase
    .from('clients')
    .update({ password_hash: newHash, must_change_password: false })
    .eq('id', session.clientId)

  if (error) return { error: error.message }

  // Changing your password ends the session, same as the team side
  // (lib/profile/actions.ts) — sign in again with the new one rather than
  // continuing on the session that was live under the old password.
  await clearClientSessionCookie()

  return { ok: true }
}
