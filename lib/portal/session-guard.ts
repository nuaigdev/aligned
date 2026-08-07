// ============================================================
// Shared "who is logged into the portal, and do they own this
// project/ticket" helpers for portal Server Components. Middleware
// already guarantees a valid session cookie exists on any request
// that reaches these pages — these helpers fetch the actual
// client_id and, for scoped resources, verify ownership.
// ============================================================

import { redirect, notFound } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getClientSession } from '@/lib/auth/client-session-cookies'
import type { Client, Project } from '@/types'

export async function requireClientSession() {
  const session = await getClientSession()
  if (!session) redirect('/')
  return session
}

/**
 * The client row plus the identity of whichever named login
 * authenticated this session (loginName/mustChangePassword come from
 * client_logins, not the client itself — see migration 045).
 */
export type SessionClient = Client & { loginName: string; mustChangePassword: boolean }

export async function getSessionClient(): Promise<SessionClient> {
  const session = await requireClientSession()
  const supabase = createServiceRoleClient()
  const [{ data: client }, { data: login }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, slug, manager_id, last_portal_seen_at, created_at, updated_at')
      .eq('id', session.clientId)
      .maybeSingle(),
    supabase
      .from('client_logins')
      .select('id, contact_name, must_change_password, is_active')
      .eq('id', session.clientLoginId)
      .maybeSingle(),
  ])

  // A revoked/deleted login must not keep working even mid-session —
  // this is what actually enforces "revoke access" for one named login.
  if (!client || !login || !login.is_active) redirect('/')

  return { ...client, loginName: login.contact_name, mustChangePassword: login.must_change_password } as SessionClient
}

export async function getSessionProject(projectId: string): Promise<Project & { clients: { id: string; name: string } }> {
  const session = await requireClientSession()
  const supabase = createServiceRoleClient()
  const { data: project } = await supabase
    .from('projects')
    .select('*, clients(id, name)')
    .eq('id', projectId)
    .maybeSingle()

  if (!project || project.client_id !== session.clientId) notFound()
  return project as any
}
