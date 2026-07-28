'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireClientSession } from '@/lib/portal/session-guard'

type DecisionAction = 'approve' | 'decline' | 'hold'

/**
 * Decisions are approved/declined/held directly from the portal —
 * unlike milestones, there's no email/token round trip for this
 * (see migration 030's write-up). Approved and declined are terminal;
 * on_hold can later be approved or declined ("accept later").
 */
export async function decidePortalDecision(input: {
  decisionId: string
  action: DecisionAction
  contactName: string
  comment?: string
}): Promise<{ ok: true } | { error: string }> {
  const session = await requireClientSession()
  if (!input.contactName.trim()) return { error: 'Let us know who this is from.' }

  const supabase = createServiceRoleClient()

  const { data: decision } = await supabase
    .from('decisions')
    .select('id, project_id, status, projects(client_id)')
    .eq('id', input.decisionId)
    .maybeSingle()

  if (!decision || (decision.projects as any)?.client_id !== session.clientId) {
    return { error: 'That decision is not part of your account.' }
  }

  if (!['pending_approval', 'on_hold'].includes(decision.status)) {
    return { error: 'This decision is no longer awaiting a response.' }
  }

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    client_decision_comment: input.comment?.trim() || null,
    client_decided_by_name: input.contactName.trim(),
    decided_at: now,
  }

  if (input.action === 'approve') {
    patch.status = 'approved'
    patch.signed_by_name = input.contactName.trim()
    patch.signed_at = now
  } else if (input.action === 'decline') {
    patch.status = 'declined'
  } else {
    patch.status = 'on_hold'
  }

  const { error } = await supabase.from('decisions').update(patch).eq('id', input.decisionId)
  if (error) return { error: error.message }

  revalidatePath(`/portal/projects/${decision.project_id}/decisions`)
  revalidatePath(`/portal/projects/${decision.project_id}/milestones`)
  revalidatePath(`/portal/projects/${decision.project_id}`)
  revalidatePath(`/dashboard/projects/${decision.project_id}/decisions`)
  return { ok: true }
}
