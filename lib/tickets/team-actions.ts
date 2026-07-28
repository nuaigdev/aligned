'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { createTicketNotifications, getActorName } from '@/lib/notifications/create'
import { sendTicketReplyEmail, sendTicketResolvedEmail } from '@/lib/email/index'
import type { CreateTicketInput, TicketStatus, TicketPriority } from '@/types'
import type { SupabaseClient } from '@supabase/supabase-js'

async function currentTeamMemberId(): Promise<string | null> {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

async function activeClientContactEmails(supabase: SupabaseClient, clientId: string): Promise<string[]> {
  const { data } = await supabase
    .from('client_contacts')
    .select('email')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .is('project_id', null)
  return (data ?? []).map(c => c.email)
}

export async function createTicket(
  input: Omit<CreateTicketInput, 'created_by_client_name'>
): Promise<{ id: string } | { error: string }> {
  const teamMemberId = await currentTeamMemberId()
  if (!teamMemberId) return { error: 'Not signed in.' }
  if (!input.title.trim()) return { error: 'Give the ticket a title.' }

  const supabase = createSupabaseServerClient()

  const { data: ticket, error } = await supabase
    .from('tickets')
    .insert({
      client_id: input.client_id,
      project_id: input.project_id || null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category || 'general',
      priority: input.priority || 'medium',
      due_date: input.due_date || null,
      created_by_team_member_id: teamMemberId,
    })
    .select('id')
    .single()

  if (error || !ticket) {
    return { error: error?.message || 'Could not create the ticket — check you have access to this client.' }
  }

  if (input.assignee_ids && input.assignee_ids.length > 0) {
    await supabase.from('ticket_assignees').insert(
      input.assignee_ids.map(teamMemberId2 => ({
        ticket_id: ticket.id,
        team_member_id: teamMemberId2,
        assigned_by: teamMemberId,
      }))
    )
  }

  const actor = await getActorName(supabase, teamMemberId)
  const { data: client } = await supabase.from('clients').select('manager_id, name').eq('id', input.client_id).maybeSingle()

  const recipients = [...(input.assignee_ids ?? [])]
  if (client?.manager_id) recipients.push(client.manager_id)

  await createTicketNotifications(
    supabase, recipients, teamMemberId,
    input.assignee_ids?.length ? 'ticket_assigned' : 'ticket_updated',
    'New ticket',
    `${actor} logged "${input.title.trim()}" for ${client?.name ?? 'a client'}`,
    ticket.id
  )

  revalidatePath('/dashboard/tickets')
  revalidatePath('/portal/tickets')
  revalidatePath('/portal')
  return { id: ticket.id }
}

export async function updateTicket(
  ticketId: string,
  patch: Partial<{
    title: string
    description: string | null
    status: TicketStatus
    priority: TicketPriority
    category: string
    due_date: string | null
    blocked_on: 'client' | 'team' | null
    project_id: string | null
  }>
): Promise<{ ok: true } | { error: string }> {
  const teamMemberId = await currentTeamMemberId()
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('tickets').update(patch).eq('id', ticketId)
  if (error) return { error: error.message }

  if (patch.status) {
    const { data: ticket } = await supabase
      .from('tickets')
      .select('title, ref_number, client_id, created_by_team_member_id, ticket_assignees(team_member_id)')
      .eq('id', ticketId)
      .maybeSingle()

    if (ticket) {
      const actor = await getActorName(supabase, teamMemberId)
      const recipients = [
        ticket.created_by_team_member_id,
        ...((ticket.ticket_assignees as any[]) ?? []).map(a => a.team_member_id),
      ].filter(Boolean) as string[]

      await createTicketNotifications(
        supabase, recipients, teamMemberId, 'ticket_status_changed',
        'Ticket updated',
        `${actor} moved "${ticket.title}" to ${patch.status.replace('_', ' ')}`,
        ticketId
      )

      if (patch.status === 'resolved') {
        const emails = await activeClientContactEmails(supabase, ticket.client_id)
        await sendTicketResolvedEmail({ toEmails: emails, ticketId, refNumber: ticket.ref_number, title: ticket.title })
      }
    }
  }

  revalidatePath('/dashboard/tickets')
  revalidatePath(`/dashboard/tickets/${ticketId}`)
  revalidatePath('/portal/tickets')
  revalidatePath(`/portal/tickets/${ticketId}`)
  return { ok: true }
}

export async function setTicketAssignees(
  ticketId: string,
  teamMemberIds: string[]
): Promise<{ ok: true } | { error: string }> {
  const teamMemberId = await currentTeamMemberId()
  if (!teamMemberId) return { error: 'Not signed in.' }

  const supabase = createSupabaseServerClient()

  const { data: existing } = await supabase
    .from('ticket_assignees')
    .select('team_member_id')
    .eq('ticket_id', ticketId)

  const currentIds = new Set((existing ?? []).map(a => a.team_member_id))
  const nextIds = new Set(teamMemberIds)

  const toAdd = teamMemberIds.filter(id => !currentIds.has(id))
  const toRemove = [...currentIds].filter(id => !nextIds.has(id))

  if (toAdd.length > 0) {
    const { error } = await supabase.from('ticket_assignees').insert(
      toAdd.map(id => ({ ticket_id: ticketId, team_member_id: id, assigned_by: teamMemberId }))
    )
    if (error) return { error: error.message }

    const { data: ticket } = await supabase.from('tickets').select('title').eq('id', ticketId).maybeSingle()
    const actor = await getActorName(supabase, teamMemberId)
    await createTicketNotifications(
      supabase, toAdd, teamMemberId, 'ticket_assigned',
      'New ticket assigned',
      `${actor} assigned you to "${ticket?.title ?? 'a ticket'}"`,
      ticketId
    )
  }

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from('ticket_assignees')
      .delete()
      .eq('ticket_id', ticketId)
      .in('team_member_id', toRemove)
    if (error) return { error: error.message }
  }

  revalidatePath('/dashboard/tickets')
  revalidatePath(`/dashboard/tickets/${ticketId}`)
  return { ok: true }
}

export async function postTicketComment(
  ticketId: string,
  body: string,
  mentionedTeamMemberIds: string[] = [],
  visibleToClient: boolean = false
): Promise<{ id: string } | { error: string }> {
  const teamMemberId = await currentTeamMemberId()
  if (!teamMemberId) return { error: 'Not signed in.' }
  if (!body.trim()) return { error: 'Comment cannot be empty.' }

  const supabase = createSupabaseServerClient()
  const { data: comment, error } = await supabase
    .from('ticket_comments')
    .insert({
      ticket_id: ticketId,
      body: body.trim(),
      mentioned_team_member_ids: mentionedTeamMemberIds,
      created_by_team_member_id: teamMemberId,
      visible_to_client: visibleToClient,
    })
    .select('id')
    .single()

  if (error || !comment) return { error: error?.message || 'Could not post the comment.' }

  const { data: ticket } = await supabase
    .from('tickets')
    .select('title, ref_number, client_id, created_by_team_member_id, ticket_assignees(team_member_id)')
    .eq('id', ticketId)
    .maybeSingle()

  if (ticket) {
    const actor = await getActorName(supabase, teamMemberId)
    const mentioned = new Set(mentionedTeamMemberIds)
    const audience = [
      ticket.created_by_team_member_id,
      ...((ticket.ticket_assignees as any[]) ?? []).map(a => a.team_member_id),
    ].filter((id): id is string => Boolean(id) && !mentioned.has(id as string))

    await createTicketNotifications(supabase, audience, teamMemberId, 'ticket_commented', 'New comment', `${actor} commented on "${ticket.title}"`, ticketId)
    await createTicketNotifications(supabase, mentionedTeamMemberIds, teamMemberId, 'ticket_mentioned', 'You were mentioned', `${actor} mentioned you on "${ticket.title}"`, ticketId)

    // Only a comment explicitly marked "reply to client" reaches the
    // client's inbox — an internal note must never leak to the client just
    // because we email on every team comment by default.
    if (visibleToClient) {
      const emails = await activeClientContactEmails(supabase, ticket.client_id)
      await sendTicketReplyEmail({ toEmails: emails, ticketId, refNumber: ticket.ref_number, title: ticket.title, replyBody: body.trim(), actorName: actor })
    }
  }

  revalidatePath(`/dashboard/tickets/${ticketId}`)
  revalidatePath(`/portal/tickets/${ticketId}`)
  return { id: comment.id }
}

export async function editTicketComment(
  commentId: string,
  body: string,
  mentionedTeamMemberIds: string[] = [],
  visibleToClient?: boolean
): Promise<{ ok: true } | { error: string }> {
  const supabase = createSupabaseServerClient()
  const { data: comment } = await supabase
    .from('ticket_comments')
    .select('ticket_id')
    .eq('id', commentId)
    .single()

  const { error } = await supabase
    .from('ticket_comments')
    .update({
      body: body.trim(),
      mentioned_team_member_ids: mentionedTeamMemberIds,
      ...(visibleToClient !== undefined ? { visible_to_client: visibleToClient } : {}),
    })
    .eq('id', commentId)

  if (error) return { error: error.message }
  if (comment) {
    revalidatePath(`/dashboard/tickets/${comment.ticket_id}`)
    revalidatePath(`/portal/tickets/${comment.ticket_id}`)
  }
  return { ok: true }
}

export async function deleteTicketComment(commentId: string): Promise<{ ok: true } | { error: string }> {
  const supabase = createSupabaseServerClient()
  const { data: comment } = await supabase
    .from('ticket_comments')
    .select('ticket_id')
    .eq('id', commentId)
    .single()

  const { error } = await supabase.from('ticket_comments').delete().eq('id', commentId)
  if (error) return { error: error.message }
  if (comment) {
    revalidatePath(`/dashboard/tickets/${comment.ticket_id}`)
    revalidatePath(`/portal/tickets/${comment.ticket_id}`)
  }
  return { ok: true }
}
