import type { SupabaseClient } from '@supabase/supabase-js'

export interface ProjectScope {
  isAdmin: boolean
  isManager: boolean
  name: string | null
  projectIds: string[]
  managedClientIds: string[]
}

/**
 * Which projects a team member should actually see on a project *list*
 * surface (Projects page, dashboard overview) — display-scoped, same
 * pattern as the "my projects" filter on the Tickets page
 * (app/dashboard/tickets/page.tsx), not an RLS change (projects/clients
 * keep the "any team member, full access" RLS policies — see CLAUDE.md).
 * Admins see everything; a Manager sees their own project memberships
 * plus every project belonging to a client they manage; a plain member
 * sees only projects they're an explicit project_members row for.
 */
export async function getMyProjectScope(supabase: SupabaseClient, userId: string): Promise<ProjectScope> {
  const { data: me } = await supabase.from('team_members').select('role, name').eq('id', userId).maybeSingle()
  const isAdmin = me?.role === 'admin'
  const isManager = me?.role === 'manager'

  const [{ data: memberships }, { data: managedClients }] = await Promise.all([
    isAdmin ? Promise.resolve({ data: [] as { project_id: string }[] }) : supabase.from('project_members').select('project_id').eq('team_member_id', userId),
    isAdmin || !isManager ? Promise.resolve({ data: [] as { id: string }[] }) : supabase.from('clients').select('id').eq('manager_id', userId),
  ])

  return {
    isAdmin,
    isManager,
    name: me?.name ?? null,
    projectIds: (memberships ?? []).map(r => r.project_id),
    managedClientIds: (managedClients ?? []).map(c => c.id),
  }
}

/**
 * Applies the scope to a `projects` query. Returns null when a non-admin
 * has no in-scope projects at all, meaning the caller should skip the
 * query rather than run an unfiltered `.or()` (an empty filter list would
 * otherwise match everything).
 */
export function scopeProjectsQuery<Q extends { or: (s: string) => any }>(query: Q, scope: ProjectScope): Q | null {
  if (scope.isAdmin) return query

  const orParts: string[] = []
  if (scope.projectIds.length) orParts.push(`id.in.(${scope.projectIds.join(',')})`)
  if (scope.managedClientIds.length) orParts.push(`client_id.in.(${scope.managedClientIds.join(',')})`)
  if (orParts.length === 0) return null

  return query.or(orParts.join(','))
}
