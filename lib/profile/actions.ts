'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, createServiceRoleClient } from '@/lib/supabase/server'

/**
 * Actions for a team member's own profile — display name and
 * password only, nothing else lives here. Deliberately separate
 * from lib/team/actions.ts, which manages OTHER people's accounts
 * and requires admin.
 */
export async function updateDisplayName(name: string): Promise<{ ok: true } | { error: string }> {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }
  if (!name.trim()) return { error: 'Name cannot be empty.' }

  const { error } = await supabase.from('team_members').update({ name: name.trim() }).eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard')
  return { ok: true }
}

/**
 * Verifies the current password before setting a new one via the admin
 * API, then clears must_change_password so the forced-change redirect in
 * middleware.ts stops firing, and signs the session out so the caller
 * comes back through a clean login with the new password.
 *
 * The verification step deliberately runs on a throwaway, non-persisting
 * client rather than the request's cookie-bound createSupabaseServerClient()
 * — calling signInWithPassword() on that client was overwriting the live
 * session cookie with a fresh one minted from the *old* password, moments
 * before that password got invalidated by the update below. That race is
 * what left people stuck on a stale session after changing their password
 * (dashboard stuck reloading, needing a hard refresh or cleared cookies to
 * recover). This client never touches cookies, so there's nothing to race.
 */
export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Not signed in.' }

  if (newPassword.length < 8) return { error: 'New password must be at least 8 characters.' }
  if (newPassword === currentPassword) return { error: 'Choose a password different from your current one.' }

  const verifyClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { error: verifyError } = await verifyClient.auth.signInWithPassword({ email: user.email, password: currentPassword })
  if (verifyError) return { error: 'Current password is incorrect.' }

  const service = createServiceRoleClient()
  const { error } = await service.auth.admin.updateUserById(user.id, { password: newPassword })
  if (error) return { error: error.message }

  await service.from('team_members').update({ must_change_password: false }).eq('id', user.id)

  // Changing your password ends the session — sign in again with the new
  // one rather than continuing on whatever session happened to still be
  // live, which is exactly the kind of state this bug came from.
  await supabase.auth.signOut()

  return { ok: true }
}
