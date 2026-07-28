'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { requireTeamRole } from '@/lib/auth/team-role-guard'
import { createClientNotification } from '@/lib/notifications/create'

/**
 * Sends a decision to the client for review — no recipient picker, no
 * email (see migration 030's write-up). Just flips status and drops a
 * notification in the client's portal bell.
 */
export async function sendDecisionForApproval(decisionId: string): Promise<{ ok: true } | { error: string }> {
  const check = await requireTeamRole(['admin', 'manager'])
  if ('error' in check) return check

  const supabase = createSupabaseServerClient()
  const { data: decision, error } = await supabase
    .from('decisions')
    .update({ status: 'pending_approval' })
    .eq('id', decisionId)
    .select('id, project_id, title, projects(client_id)')
    .single()

  if (error) return { error: error.message }

  const clientId = (decision.projects as any)?.client_id
  if (clientId) {
    const service = createServiceRoleClient()
    await createClientNotification(
      service, clientId, 'decision_pending',
      'New decision awaiting your review', decision.title,
      `/portal/projects/${decision.project_id}/decisions`
    )
  }

  revalidatePath(`/dashboard/projects/${decision.project_id}/decisions`)
  revalidatePath(`/portal/projects/${decision.project_id}/decisions`)
  revalidatePath(`/portal/projects/${decision.project_id}`)
  return { ok: true }
}
