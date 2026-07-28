'use server'

import { revalidatePath } from 'next/cache'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { requireClientSession } from '@/lib/portal/session-guard'
import { createTicketNotifications } from '@/lib/notifications/create'
import { sendTicketConfirmationEmail } from '@/lib/email/index'

export async function createPortalTicket(input: {
  title: string
  description?: string
  category?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  project_id?: string
  contact_name: string
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
      priority: input.priority || 'medium',
      created_by_client_name: input.contact_name.trim(),
    })
    .select('id, ref_number')
    .single()

  if (error || !ticket) {
    return { error: error?.message || 'Could not create the ticket.' }
  }

  // Notify the client's assigned Manager in-app — they're a real Supabase
  // Auth session, unlike the client's shared login.
  const { data: client } = await supabase.from('clients').select('name, manager_id').eq('id', session.clientId).maybeSingle()
  if (client?.manager_id) {
    await createTicketNotifications(
      supabase, [client.manager_id], null, 'ticket_updated',
      'New ticket from a client',
      `${input.contact_name.trim()} (${client.name}) logged "${input.title.trim()}"`,
      ticket.id
    )
  }

  // Email confirmation to the client's own active contacts.
  const { data: contacts } = await supabase
    .from('client_contacts')
    .select('email')
    .eq('client_id', session.clientId)
    .eq('is_active', true)
    .is('project_id', null)

  await sendTicketConfirmationEmail({
    toEmails: (contacts ?? []).map(c => c.email),
    ticketId: ticket.id,
    refNumber: ticket.ref_number,
    title: input.title.trim(),
    raisedByName: input.contact_name.trim(),
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
}): Promise<{ id: string } | { error: string }> {
  const session = await requireClientSession()
  if (!input.body.trim()) return { error: 'Comment cannot be empty.' }
  if (!input.contact_name.trim()) return { error: 'Let us know who this is from.' }

  const supabase = createServiceRoleClient()

  const { data: ticket } = await supabase
    .from('tickets')
    .select('client_id, title, created_by_team_member_id, ticket_assignees(team_member_id), clients(manager_id)')
    .eq('id', input.ticket_id)
    .maybeSingle()

  if (!ticket || ticket.client_id !== session.clientId) {
    return { error: 'That ticket is not part of your account.' }
  }

  const { data: comment, error } = await supabase
    .from('ticket_comments')
    .insert({
      ticket_id: input.ticket_id,
      body: input.body.trim(),
      created_by_client_name: input.contact_name.trim(),
    })
    .select('id')
    .single()

  if (error || !comment) return { error: error?.message || 'Could not post the comment.' }

  const recipients = [
    ticket.created_by_team_member_id,
    (ticket.clients as any)?.manager_id,
    ...((ticket.ticket_assignees as any[]) ?? []).map(a => a.team_member_id),
  ].filter(Boolean) as string[]

  await createTicketNotifications(
    supabase, recipients, null, 'ticket_commented',
    'New client reply',
    `${input.contact_name.trim()} replied on "${ticket.title}"`,
    input.ticket_id
  )

  revalidatePath(`/portal/tickets/${input.ticket_id}`)
  revalidatePath('/dashboard/tickets')
  revalidatePath(`/dashboard/tickets/${input.ticket_id}`)
  return { id: comment.id }
}
