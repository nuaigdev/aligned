'use server'

import { createServiceRoleClient } from '@/lib/supabase/server'
import { verifyPassword } from '@/lib/auth/client-session'
import { setClientSessionCookie, clearClientSessionCookie } from '@/lib/auth/client-session-cookies'

export async function loginClient(loginId: string, password: string): Promise<{ error?: string }> {
  if (!loginId.trim() || !password) {
    return { error: 'Enter your login ID and password.' }
  }

  const supabase = createServiceRoleClient()
  const { data: client } = await supabase
    .from('clients')
    .select('id, password_hash')
    .eq('login_id', loginId.trim())
    .maybeSingle()

  if (!client?.password_hash) {
    return { error: 'Invalid login ID or password.' }
  }

  const valid = await verifyPassword(password, client.password_hash)
  if (!valid) {
    return { error: 'Invalid login ID or password.' }
  }

  await supabase
    .from('clients')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', client.id)

  await setClientSessionCookie(client.id)
  return {}
}

export async function logoutClient() {
  await clearClientSessionCookie()
}
