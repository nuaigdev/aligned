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
  if (!session) redirect('/portal/login')
  return session
}

export async function getSessionClient(): Promise<Client> {
  const session = await requireClientSession()
  const supabase = createServiceRoleClient()
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, slug, manager_id, login_id, must_change_password, last_login_at, created_at, updated_at')
    .eq('id', session.clientId)
    .maybeSingle()

  if (!client) redirect('/portal/login')
  return client as Client
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
