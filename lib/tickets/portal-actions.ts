'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireClientSession } from '@/lib/portal/session-guard'
import { createTicketNotifications } from '@/lib/notifications/create'
import { sendTicketConfirmationEmail } from '@/lib/email/index'
import { getTicketContactRecipients, getManagerContact, withManagerCopy } from '@/lib/tickets/contacts'
import { ticketClientCode } from '@/lib/utils'

export async function createPortalTicket(input: {
  title: string
  description?: string
  category?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  project_id?: string
  contact_name: string
  attachments?: Array<{ storage_path: string; name: string; file_type: string | null; file_size_bytes: number }>
}): Promise<{ id: string } | { error: string }> {
  const session = await requireClientSession()
  if (!input.title.trim()) return { error: 'Give the ticket a title.' }
  if (!input.contact_name.trim()) return { error: 'Let us know who this is from.' }

  const supabase = createServiceRoleClient()

  // Defense in depth: a project_id, if given, must actually belong to this client —
  // the portal bypasses RLS via the service-role client, so this check is what
  // stands in for it (mirrors CLAUDE.md's existing portal architecture).
  if (input.project_id) {
    const { data: project } = await supabase
      .from('projects')
      .select('client_id')
      .eq('id', input.project_id)
      .maybeSingle()
    if (!project || project.client_id !== session.clientId) {
      return { error: 'That project is not part of your account.' }
    }
  }

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      client_id: session.clientId,
      project_id: input.project_id || null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category || 'general',
      // Clients can only ever raise a client-visible ticket — 'internal' is
      // exclusively a team-side classification (see migration 033).
      ticket_type: 'client',
      priority: input.priority || 'medium',
      created_by_client_name: input.contact_name.trim(),
    })
    .select('id, ref_number')
    .single()

  if (error || !ticket) {
    return { error: error?.message || 'Could not create the ticket.' }
  }

  // Files picked in the form were already uploaded to storage under a
  // per-session draft prefix (uploadDraftPortalAttachment below) so they
  // could be removed pre-submit; now that the ticket exists, turn each into
  // a permanent documents row. Once this runs there's no client-facing
  // delete for these (see PortalTicketAttachments.tsx / migration 044) —
  // a client's attachment is meant to be a permanent part of the record.
  if (input.attachments && input.attachments.length > 0) {
    await supabase.from('documents').insert(
      input.attachments.map(a => ({
        project_id: input.project_id || null,
        ticket_id: ticket.id,
        name: a.name,
        storage_path: a.storage_path,
        file_type: a.file_type,
        file_size_bytes: a.file_size_bytes,
        shared_by: 'client' as const,
      }))
    )
  }

  // Notify the client's assigned Manager in-app — they're a real Supabase
  // Auth session, unlike the client's shared login.
  const { data: client } = await supabase.from('clients').select('name, slug, manager_id').eq('id', session.clientId).maybeSingle()
  if (client?.manager_id) {
    await createTicketNotifications(
      supabase, [client.manager_id], null, 'ticket_updated',
      'New ticket from a client',
      `${input.contact_name.trim()} (${client.name}) logged "${input.title.trim()}"`,
      ticket.id
    )
  }

  // Email confirmation to the ticket's effective contact list (client
  // defaults + this project's additions), plus a copy to the client's
  // assigned Manager.
  const [contacts, manager] = await Promise.all([
    getTicketContactRecipients(supabase, session.clientId, input.project_id || null),
    getManagerContact(supabase, client?.manager_id),
  ])

  await sendTicketConfirmationEmail({
    recipients: withManagerCopy(contacts, manager),
    ticketId: ticket.id,
    refNumber: ticket.ref_number,
    title: input.title.trim(),
    raisedByName: input.contact_name.trim(),
    raisedByRole: 'client',
    clientCode: client?.slug ? ticketClientCode(client.slug) : undefined,
  })

  revalidatePath('/portal/tickets')
  revalidatePath('/portal')
  // This ticket was raised from the portal — the dashboard board/detail
  // pages need telling too, or the team keeps seeing a stale (pre-ticket)
  // list until something else happens to revalidate that route.
  revalidatePath('/dashboard/tickets')
  return { id: ticket.id }
}

export async function postPortalComment(input: {
  ticket_id: string
  body: string
  contact_name: string
  mentioned_team_member_ids?: string[]
}): Promise<{ id: string } | { error: string }> {
  const session = await requireClientSession()
  if (!input.body.trim()) return { error: 'Comment cannot be empty.' }
  if (!input.contact_name.trim()) return { error: 'Let us know who this is from.' }

  const supabase = createServiceRoleClient()

  const { data: ticket } = await supabase
    .from('tickets')
    .select('client_id, title, ticket_type, created_by_team_member_id, ticket_assignees(team_member_id), clients(manager_id)')
    .eq('id', input.ticket_id)
    .maybeSingle()

  if (!ticket || ticket.client_id !== session.clientId || ticket.ticket_type !== 'client') {
    return { error: 'That ticket is not part of your account.' }
  }

  const mentionedIds = input.mentioned_team_member_ids ?? []

  const { data: comment, error } = await supabase
    .from('ticket_comments')
    .insert({
      ticket_id: input.ticket_id,
      body: input.body.trim(),
      created_by_client_name: input.contact_name.trim(),
      mentioned_team_member_ids: mentionedIds,
    })
    .select('id, mentioned_team_member_ids')
    .single()

  if (error || !comment) return { error: error?.message || 'Could not post the comment.' }

  // filter_ticket_comment_mentions (migration 009) may have stripped ids that
  // aren't on this client's team — notify only what actually stuck.
  const confirmedMentions: string[] = comment.mentioned_team_member_ids ?? []
  const mentionedSet = new Set(confirmedMentions)

  const recipients = [
    ticket.created_by_team_member_id,
    (ticket.clients as any)?.manager_id,
    ...((ticket.ticket_assignees as any[]) ?? []).map(a => a.team_member_id),
  ].filter((id): id is string => Boolean(id) && !mentionedSet.has(id))

  await createTicketNotifications(
    supabase, recipients, null, 'ticket_commented',
    'New client reply',
    `${input.contact_name.trim()} replied on "${ticket.title}"`,
    input.ticket_id
  )

  if (confirmedMentions.length > 0) {
    await createTicketNotifications(
      supabase, confirmedMentions, null, 'ticket_mentioned',
      'You were mentioned',
      `${input.contact_name.trim()} mentioned you on "${ticket.title}"`,
      input.ticket_id
    )
  }

  revalidatePath(`/portal/tickets/${input.ticket_id}`)
  revalidatePath('/dashboard/tickets')
  revalidatePath(`/dashboard/tickets/${input.ticket_id}`)
  return { id: comment.id }
}

async function assertOwnPortalComment(supabase: ReturnType<typeof createServiceRoleClient>, commentId: string, clientId: string) {
  const { data: comment } = await supabase
    .from('ticket_comments')
    .select('ticket_id, created_by_client_name, tickets!inner(client_id, ticket_type)')
    .eq('id', commentId)
    .maybeSingle()

  if (
    !comment
    || !comment.created_by_client_name
    || (comment.tickets as any)?.client_id !== clientId
    || (comment.tickets as any)?.ticket_type !== 'client'
  ) {
    return null
  }
  return comment
}

export async function editPortalComment(
  commentId: string,
  body: string
): Promise<{ ok: true } | { error: string }> {
  const session = await requireClientSession()
  if (!body.trim()) return { error: 'Comment cannot be empty.' }

  const supabase = createServiceRoleClient()
  const comment = await assertOwnPortalComment(supabase, commentId, session.clientId)
  if (!comment) return { error: 'That comment is not part of your account.' }

  const { error } = await supabase.from('ticket_comments').update({ body: body.trim() }).eq('id', commentId)
  if (error) return { error: error.message }

  revalidatePath(`/portal/tickets/${comment.ticket_id}`)
  revalidatePath(`/dashboard/tickets/${comment.ticket_id}`)
  return { ok: true }
}

export async function deletePortalComment(commentId: string): Promise<{ ok: true } | { error: string }> {
  const session = await requireClientSession()
  const supabase = createServiceRoleClient()
  const comment = await assertOwnPortalComment(supabase, commentId, session.clientId)
  if (!comment) return { error: 'That comment is not part of your account.' }

  const { error } = await supabase.from('ticket_comments').delete().eq('id', commentId)
  if (error) return { error: error.message }

  revalidatePath(`/portal/tickets/${comment.ticket_id}`)
  revalidatePath(`/dashboard/tickets/${comment.ticket_id}`)
  return { ok: true }
}

/**
 * Polled from PortalTicketComments.tsx — the client portal session isn't a
 * Supabase Auth principal, so it can't authenticate a Realtime subscription
 * the way the dashboard side does (TicketComments.tsx); polling this action
 * every few seconds is the substitute so replies show up without a manual
 * refresh.
 */
export async function getPortalTicketComments(ticketId: string): Promise<
  | { comments: Array<{ id: string; body: string; created_at: string; edited_at: string | null; created_by_client_name: string | null; author_name: string | null }> }
  | { error: string }
> {
  const session = await requireClientSession()
  const supabase = createServiceRoleClient()

  const { data: ticket } = await supabase.from('tickets').select('client_id, ticket_type').eq('id', ticketId).maybeSingle()
  if (!ticket || ticket.client_id !== session.clientId || ticket.ticket_type !== 'client') return { error: 'That ticket is not part of your account.' }

  const [{ data: comments }, { data: teamMembers }] = await Promise.all([
    supabase
      .from('ticket_comments')
      .select('*')
      .eq('ticket_id', ticketId)
      .or('created_by_client_name.not.is.null,visible_to_client.eq.true')
      .order('created_at'),
    supabase.from('team_members').select('id, name').eq('is_active', true),
  ])

  const authorNameById = new Map((teamMembers ?? []).map(m => [m.id, m.name]))
  const enriched = (comments ?? []).map(c => ({
    id: c.id,
    body: c.body,
    created_at: c.created_at,
    edited_at: c.edited_at,
    created_by_client_name: c.created_by_client_name,
    author_name: c.created_by_team_member_id ? authorNameById.get(c.created_by_team_member_id) ?? null : null,
  }))

  return { comments: enriched }
}

export async function uploadPortalAttachment(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const session = await requireClientSession()
  const ticketId = String(formData.get('ticket_id') || '')
  const file = formData.get('file') as File | null

  if (!ticketId || !file) return { error: 'Missing file.' }

  const supabase = createServiceRoleClient()
  const { data: ticket } = await supabase.from('tickets').select('client_id, project_id, ticket_type').eq('id', ticketId).maybeSingle()
  if (!ticket || ticket.client_id !== session.clientId || ticket.ticket_type !== 'client') return { error: 'That ticket is not part of your account.' }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `tickets/${ticketId}/${Date.now()}_${safeName}`

  const { error: storageErr } = await supabase.storage
    .from('project-documents')
    .upload(storagePath, file, { cacheControl: '3600', upsert: false })
  if (storageErr) return { error: storageErr.message }

  const { error } = await supabase.from('documents').insert({
    project_id: ticket.project_id,
    ticket_id: ticketId,
    name: file.name,
    storage_path: storagePath,
    file_type: ext || null,
    file_size_bytes: file.size,
    shared_by: 'client',
  })
  if (error) return { error: error.message }

  revalidatePath(`/portal/tickets/${ticketId}`)
  revalidatePath(`/dashboard/tickets/${ticketId}`)
  return { ok: true }
}

/**
 * A client can remove an attachment they added themselves — but never one
 * the team added (shared_by check below), and the RLS override on
 * documents_ticket_attachment_delete (migration 044) that lets an admin
 * remove a client's attachment doesn't apply here at all: the portal
 * always uses the service-role client and does its own authorization
 * (rule 4), scoped to "this client's own ticket, this client's own
 * upload" — the shared portal login is one identity for the whole
 * company, not per-contact, so any user under that login can manage any
 * of the client's own attachments, same as editPortalComment.
 */
export async function deletePortalAttachment(documentId: string): Promise<{ ok: true } | { error: string }> {
  const session = await requireClientSession()
  const supabase = createServiceRoleClient()

  const { data: doc } = await supabase
    .from('documents')
    .select('id, ticket_id, storage_path, shared_by, tickets!inner(client_id, ticket_type)')
    .eq('id', documentId)
    .maybeSingle()

  if (
    !doc
    || doc.shared_by !== 'client'
    || (doc.tickets as any)?.client_id !== session.clientId
    || (doc.tickets as any)?.ticket_type !== 'client'
  ) {
    return { error: 'That attachment is not part of your account.' }
  }

  await supabase.storage.from('project-documents').remove([doc.storage_path])
  const { error } = await supabase.from('documents').delete().eq('id', documentId)
  if (error) return { error: error.message }

  revalidatePath(`/portal/tickets/${doc.ticket_id}`)
  revalidatePath(`/dashboard/tickets/${doc.ticket_id}`)
  return { ok: true }
}

/**
 * Attaching a file on the "New ticket" form, before the ticket exists yet.
 * Uploads straight to storage under a per-client draft prefix — no
 * `documents` row is created here, so removeDraftPortalAttachment can just
 * delete the storage object outright rather than needing an ownership
 * check against a DB row (there's nothing to scope the client to a
 * documents row not yet in existence, and no ticket to attach it to).
 * createPortalTicket() turns each surviving upload into a permanent
 * documents row once the ticket is created.
 */
export async function uploadDraftPortalAttachment(formData: FormData): Promise<
  | { storage_path: string; name: string; file_type: string | null; file_size_bytes: number }
  | { error: string }
> {
  const session = await requireClientSession()
  const file = formData.get('file') as File | null
  if (!file) return { error: 'Missing file.' }

  const supabase = createServiceRoleClient()
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `tickets/draft/${session.clientId}/${Date.now()}_${safeName}`

  const { error: storageErr } = await supabase.storage
    .from('project-documents')
    .upload(storagePath, file, { cacheControl: '3600', upsert: false })
  if (storageErr) return { error: storageErr.message }

  return { storage_path: storagePath, name: file.name, file_type: ext || null, file_size_bytes: file.size }
}

/** Remove a file attached before the ticket was submitted — see the note above. */
export async function removeDraftPortalAttachment(storagePath: string): Promise<{ ok: true } | { error: string }> {
  const session = await requireClientSession()

  // The storage path is namespaced by clientId (uploadDraftPortalAttachment
  // above) — this is the ownership check, since there's no documents row to
  // check against for a not-yet-linked draft upload.
  if (!storagePath.startsWith(`tickets/draft/${session.clientId}/`)) {
    return { error: 'That file is not part of your account.' }
  }

  const supabase = createServiceRoleClient()
  const { error } = await supabase.storage.from('project-documents').remove([storagePath])
  if (error) return { error: error.message }
  return { ok: true }
}
