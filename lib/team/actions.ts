'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import type { TeamRole } from '@/types'

/**
 * Every action here re-checks the caller is an admin server-side — the
 * "Team" nav item being hidden from non-admins is a UI nicety, not the
 * security boundary. This is the one place in the app that manages other
 * people's accounts, so it's worth being paranoid.
 */
async function requireAdmin(): Promise<{ id: string } | { error: string }> {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  const { data: member } = await supabase.from('team_members').select('role').eq('id', user.id).maybeSingle()
  if (member?.role !== 'admin') return { error: 'Only admins can manage team members.' }
  return { id: user.id }
}

export async function createTeamMember(input: {
  name: string
  email: string
  role: TeamRole
  managerId: string | null
}): Promise<{ password: string; id: string } | { error: string }> {
  const admin = await requireAdmin()
  if ('error' in admin) return admin

  if (!input.name.trim() || !input.email.trim()) return { error: 'Name and email are required.' }

  const service = createServiceRoleClient()
  const password = generateTempPassword()

  const { data, error } = await service.auth.admin.createUser({
    email: input.email.trim(),
    password,
    email_confirm: true,
    user_metadata: { name: input.name.trim() },
  })

  if (error || !data.user) return { error: error?.message || 'Could not create the account.' }

  const userId = data.user.id

  // handle_new_auth_user auto-inserts a 'member' row — but don't assume it
  // worked (see migration 020/021's write-up on why it can silently fail).
  const { data: existing } = await service.from('team_members').select('id').eq('id', userId).maybeSingle()

  if (existing) {
    const { error: updateError } = await service
      .from('team_members')
      .update({ role: input.role, manager_id: input.managerId })
      .eq('id', userId)
    if (updateError) return { error: updateError.message }
  } else {
    const { error: insertError } = await service
      .from('team_members')
      .insert({ id: userId, name: input.name.trim(), email: input.email.trim(), role: input.role, manager_id: input.managerId })
    if (insertError) return { error: insertError.message }
  }

  revalidatePath('/dashboard/team')
  return { password, id: userId }
}

export async function updateTeamMemberRole(memberId: string, role: TeamRole): Promise<{ ok: true } | { error: string }> {
  const admin = await requireAdmin()
  if ('error' in admin) return admin

  const service = createServiceRoleClient()
  const { error } = await service.from('team_members').update({ role }).eq('id', memberId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/team')
  return { ok: true }
}

export async function updateTeamMemberManager(memberId: string, managerId: string | null): Promise<{ ok: true } | { error: string }> {
  const admin = await requireAdmin()
  if ('error' in admin) return admin

  const service = createServiceRoleClient()
  const { error } = await service.from('team_members').update({ manager_id: managerId }).eq('id', memberId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/team')
  return { ok: true }
}

export async function setTeamMemberActive(memberId: string, isActive: boolean): Promise<{ ok: true } | { error: string }> {
  const admin = await requireAdmin()
  if ('error' in admin) return admin

  const service = createServiceRoleClient()
  const { error } = await service.from('team_members').update({ is_active: isActive }).eq('id', memberId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/team')
  return { ok: true }
}

/**
 * Deletes via the Auth admin API (not a direct table delete) so it cascades
 * cleanly — team_members.id references auth.users(id) ON DELETE CASCADE.
 */
export async function deleteTeamMember(memberId: string): Promise<{ ok: true } | { error: string }> {
  const admin = await requireAdmin()
  if ('error' in admin) return admin
  if (admin.id === memberId) return { error: "You can't delete your own account." }

  const service = createServiceRoleClient()
  const { error } = await service.auth.admin.deleteUser(memberId)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/team')
  return { ok: true }
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) out += '-'
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}
