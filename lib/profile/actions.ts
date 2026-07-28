'use server'

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
 * Verifies the current password by re-authenticating (same reasoning
 * as the client portal's changeClientPassword) before setting a new
 * one via the admin API, then clears must_change_password so the
 * forced-change redirect in dashboard/layout.tsx stops firing.
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

  const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword })
  if (verifyError) return { error: 'Current password is incorrect.' }

  const service = createServiceRoleClient()
  const { error } = await service.auth.admin.updateUserById(user.id, { password: newPassword })
  if (error) return { error: error.message }

  await service.from('team_members').update({ must_change_password: false }).eq('id', user.id)

  return { ok: true }
}
