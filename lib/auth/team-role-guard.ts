'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { TeamRole } from '@/types'

/**
 * Shared "is the caller one of these roles" check for Server Actions
 * that gate creation of clients/projects/team members. UI hiding a
 * button is never the security boundary — this is what actually
 * enforces it, matching the paranoia already established in
 * lib/team/actions.ts's requireAdmin.
 */
export async function requireTeamRole(allowed: TeamRole[]): Promise<{ id: string; role: TeamRole } | { error: string }> {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  const { data: member } = await supabase.from('team_members').select('role').eq('id', user.id).maybeSingle()
  if (!member || !allowed.includes(member.role as TeamRole)) {
    return { error: `Only ${allowed.join(' or ')} can do this.` }
  }
  return { id: user.id, role: member.role as TeamRole }
}
