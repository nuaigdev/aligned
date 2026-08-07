'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { verifyPassword } from '@/lib/auth/client-session'
import { setClientSessionCookie, clearClientSessionCookie } from '@/lib/auth/client-session-cookies'

export async function loginClient(loginId: string, password: string): Promise<{ error?: string }> {
  if (!loginId.trim() || !password) {
    return { error: 'Enter your login ID and password.' }
  }

  const supabase = createServiceRoleClient()
  const { data: login } = await supabase
    .from('client_logins')
    .select('id, client_id, password_hash, is_active')
    .eq('login_id', loginId.trim().toLowerCase())
    .maybeSingle()

  if (!login?.password_hash || !login.is_active) {
    return { error: 'Invalid login ID or password.' }
  }

  const valid = await verifyPassword(password, login.password_hash)
  if (!valid) {
    return { error: 'Invalid login ID or password.' }
  }

  await supabase
    .from('client_logins')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', login.id)

  await setClientSessionCookie(login.client_id, login.id)
  return {}
}

export async function logoutClient() {
  await clearClientSessionCookie()
}
